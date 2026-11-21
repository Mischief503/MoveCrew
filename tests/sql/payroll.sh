#!/usr/bin/env bash
# Payroll (supabase-payroll.sql, batch 8, Nov 20): HR is the owner and the people in the settings' hr list. HR reads
# every clock row and fixes them; reads a pay period's jobs and the profiles' payroll details through the functions;
# saves the payroll settings, a tip split and a payroll ID through them, each checked. Everyone else is where they were.
# On a job, only the office, HR or a lead on it changes the tip split. The file runs twice cleanly, and the rules it
# writes are exactly the base files' (running supabase-callcenter.sql again changes nothing).
set -e
PGBIN=$(ls -d /usr/lib/postgresql/*/bin | head -1)
D=$(mktemp -d); $PGBIN/initdb -D $D -U postgres >/dev/null
$PGBIN/pg_ctl -D $D -o "-k $D -p 55442 -c listen_addresses=''" -l $D/log start >/dev/null
trap '$PGBIN/pg_ctl -D $D stop >/dev/null' EXIT
P="psql -h $D -p 55442 -U postgres -v ON_ERROR_STOP=1 -q"
$P -c "create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;"
$P -c "create database t"
$P -d t <<'SQL'
create schema auth;
create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
grant usage on schema auth, public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
create publication supabase_realtime;
create schema storage;
create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid default auth.uid(), metadata jsonb, created_at timestamptz default now());
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated, service_role;
insert into auth.users values
 ('dddddddd-0000-0000-0000-000000000001','own@x.com', now()),('dddddddd-0000-0000-0000-000000000002','dis@x.com', now()),
 ('dddddddd-0000-0000-0000-000000000003','marcus@x.com', now()),('dddddddd-0000-0000-0000-000000000004','riley@x.com', now()),
 ('dddddddd-0000-0000-0000-000000000005','dee@x.com', now()),('dddddddd-0000-0000-0000-000000000006','other@x.com', now());
SQL
$P -d t -f supabase/sql/supabase-schema-v2.sql
$P -d t -f supabase/sql/supabase-employees.sql
$P -d t -f supabase/sql/supabase-payments.sql
$P -d t -f supabase/sql/supabase-callcenter.sql
$P -d t -f supabase/sql/supabase-payroll.sql
$P -d t -f supabase/sql/supabase-payroll.sql
FAILS=0
echo "PASS supabase-payroll.sql runs twice cleanly"
OWN=dddddddd-0000-0000-0000-000000000001; DIS=dddddddd-0000-0000-0000-000000000002; MARCUS=dddddddd-0000-0000-0000-000000000003
RILEY=dddddddd-0000-0000-0000-000000000004; DEE=dddddddd-0000-0000-0000-000000000005; OTHER=dddddddd-0000-0000-0000-000000000006
as(){ $P -d t -tA -c "set role authenticated; set request.jwt.claim.sub='$1'; $2" 2>&1 | tail -1; }
pg(){ $P -d t -tA -c "$1" 2>&1 | tail -1; }
check(){ got=$(as "$1" "$3"); if [ "$got" = "$2" ]; then echo "PASS $4"; else echo "FAIL $4: got '$got' want '$2'"; FAILS=1; fi; }
says(){ got=$($P -d t -tA -c "set role authenticated; set request.jwt.claim.sub='$1'; $2" 2>&1 | tr '\n' ' '); case "$got" in *"$3"*) echo "PASS $4";; *) echo "FAIL $4: got '$got'"; FAILS=1;; esac; }
same(){ if [ "$1" = "$2" ]; then echo "PASS $3"; else echo "FAIL $3: got '$1' want '$2'"; FAILS=1; fi; }
doc(){ echo "insert into docs(org_id,path,collection,doc_id,data) values ('$1','$2','${2%%/*}','${2#*/}','$3') on conflict (org_id,path) do update set data=excluded.data returning 1"; }
rules(){ $P -d t -tA -c "select md5(string_agg(x, E'\n' order by x)) from (
  select polname||' '||coalesce(pg_get_expr(polqual, polrelid),'')||' / '||coalesce(pg_get_expr(polwithcheck, polrelid),'') x from pg_policy where polrelid='public.docs'::regclass
  union all select p.proname||' '||md5(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('can_write_doc','hr_of')) s"; }

O=$(as $OWN "select public.create_org('Ace Moving')"); O2=$(as $OTHER "select public.create_org('Other Co')")
for p in "$DIS:Dispatch:dispatch" "$MARCUS:Marcus:crew" "$RILEY:Riley:crew" "$DEE:Dee:lead"; do IFS=: read U N R <<<"$p"
  as $OWN "insert into members(org_id,user_id,email,staff,role,ts) values ('$O','$U','x','$N','$R',1)" >/dev/null; done
as $OWN "$(doc $O org/settings '{"company":"Ace Moving","crew":["Marcus","Riley","Dee"],"leads":["Dee"],"hr":[]}')" >/dev/null
for s in 'm1:{"id":"m1","who":"Marcus","inAt":1763650000000,"outAt":1763680000000}' 'r1:{"id":"r1","who":"Riley","inAt":1763650000000,"outAt":1763690000000}' 'd1:{"id":"d1","who":"Dee","inAt":1763650000000,"outAt":0}'; do
  as $OWN "$(doc $O shifts/${s%%:*} "${s#*:}")" >/dev/null; done
for j in 'j1:{"id":"j1","status":"done","d":{"name":"Priya","moveDate":"2026-11-10"},"assign":{"crew":["Riley","Dee"]},"actualHours":4,"payments":{"p1":{"id":"p1","amt":500,"tip":60,"date":"2026-11-10"}}}' \
         'j2:{"id":"j2","status":"paid","d":{"name":"Late pay","moveDate":"2026-10-01"},"assign":{"crew":["Dee"]},"payments":{"p2":{"id":"p2","amt":900,"date":"2026-11-12"}}}' \
         'j3:{"id":"j3","status":"done","d":{"name":"Too early","moveDate":"2026-10-01"},"assign":{"crew":["Riley"]},"payments":{}}' \
         'j4:{"id":"j4","status":"quoted","d":{"name":"Open quote","moveDate":"2026-11-11"},"payments":{}}' \
         'j5:{"id":"j5","status":"active","d":{"name":"Running"},"finishedAt":null,"startedAt":1794470400000,"assign":{"crew":["Marcus"]},"payments":{}}' \
         'j6:{"id":"j6","status":"done","d":{"name":"No date"},"finishedAt":1794398400000,"assign":{"crew":["Riley"]},"payments":{}}'; do
  as $DIS "$(doc $O jobs/${j%%:*} "${j#*:}")" >/dev/null; done
as $OTHER "$(doc $O2 jobs/z1 '{"id":"z1","status":"done","d":{"name":"Not yours","moveDate":"2026-11-10"},"payments":{}}')" >/dev/null
as $OWN "insert into employees(org_id,name,role,email,info) values ('$O','Marcus','crew','marcus@x.com','{\"payrollId\":\"E-100\",\"workerType\":\"W-2 employee\",\"payType\":\"Hourly\",\"payRate\":\"24\"}'),('$O','Riley','crew','riley@x.com','{\"payType\":\"Hourly\"}'),('$O','Dee','lead','dee@x.com','{\"workerType\":\"1099 contractor\"}')" >/dev/null

# ---- who has HR
check $OWN "t" "select public.hr_of('$O')" "the owner has HR"
check $DIS "f" "select public.hr_of('$O')" "dispatch doesn't, until the owner switches it on"
check $MARCUS "f" "select public.hr_of('$O')" "nor does the crew"
check $MARCUS "1" "select count(*) from docs where collection='shifts'" "before HR: Marcus reads only his own clock rows"
says $MARCUS "select count(*) from payroll_jobs('$O','2026-11-09','2026-11-22')" "Only HR can see payroll" "and can't ask for a pay period's jobs"
says $MARCUS "select count(*) from payroll_people('$O')" "Only HR can see payroll" "or the payroll details"
as $OWN "$(doc $O org/settings '{"company":"Ace Moving","crew":["Marcus","Riley","Dee"],"leads":["Dee"],"hr":["Marcus"]}')" >/dev/null
check $MARCUS "t" "select public.hr_of('$O')" "the owner switches HR on for Marcus (the settings' hr list)"
check $MARCUS "f" "select public.hr_of('$O2')" "in his own company only"
check $RILEY "f" "select public.hr_of('$O')" "Riley, not in the list, still hasn't"

# ---- the clock rows
check $MARCUS "d1,m1,r1" "select string_agg(doc_id, ',' order by doc_id) from docs where collection='shifts'" "HR reads everyone's clock rows"
check $RILEY "r1" "select string_agg(doc_id, ',' order by doc_id) from docs where collection='shifts'" "the crew still reads only their own"
check $MARCUS "1" "update docs set data = jsonb_set(data, '{outAt}', '1763685000000') where path='shifts/r1' returning 1" "HR fixes someone else's clock-out"
check $OWN "1763685000000" "select data->>'outAt' from docs where path='shifts/r1'" "and it's saved"
check $MARCUS "1" "$(doc $O shifts/r2 '{"id":"r2","who":"Riley","inAt":1763736400000,"outAt":1763765200000,"added":{"by":"Marcus"}}')" "HR adds a missed shift for someone else"
check $RILEY "" "update docs set data = jsonb_set(data, '{outAt}', '1') where path='shifts/m1' returning 1" "the crew can't change someone else's clock row"
says $RILEY "$(doc $O shifts/x9 '{"id":"x9","who":"Marcus","inAt":1,"outAt":2}')" "row-level security" "or add one for them"
check $MARCUS "0" "select count(*) from docs where path='jobs/j1'" "HR reads no more of the jobs themselves than before"
check $MARCUS "" "update docs set data = data where collection = 'org' returning 1" "and doesn't write the settings directly"

# ---- a pay period's jobs
check $MARCUS "j1,j2,j6" "select string_agg(x->>'id', ',' order by x->>'id') from payroll_jobs('$O','2026-11-09','2026-11-22') x" "a pay period: the jobs worked then (by the move day, or the finish without one) and the one paid then; not one worked before, an open quote, a running job outside it, or another company's"
check $MARCUS "" "select string_agg(x->>'id', ',') from payroll_jobs('$O','2026-11-01','2026-12-31') x where x->>'status'='active'" "a running job with no move day doesn't come"
pg "update docs set data = jsonb_set(data, '{d,moveDate}', '\"2026-11-12\"') where path='jobs/j5'" >/dev/null
check $MARCUS "j2,j5,j6" "select string_agg(x->>'id', ',' order by x->>'id') from payroll_jobs('$O','2026-11-12','2026-11-13') x" "a running job on its move day comes (the app says it isn't finished), and a day either side (j6 finished on the 11th) for time zones"
check $OWN "j1,j6" "select string_agg(x->>'id', ',' order by x->>'id') from payroll_jobs('$O','2026-11-10','2026-11-10') x" "the owner asks the same way"
says $MARCUS "select count(*) from payroll_jobs('$O','2026-09-01','2026-11-22')" "up to 10 weeks" "ten weeks at most"
says $MARCUS "select count(*) from payroll_jobs('$O2','2026-11-09','2026-11-22')" "Only HR can see payroll" "not another company's"

# ---- the payroll details
check $MARCUS "Dee||1099 contractor|true,Marcus|E-100|W-2 employee|true,Riley||Hourly|true" "select string_agg(name||'|'||payroll_id||'|'||coalesce(nullif(worker_type,''),nullif(pay_type,''),'')||'|'||active, ',' order by name) from payroll_people('$O')" "HR reads each profile's payroll ID, worker type and pay type"
check $MARCUS "0" "select count(*) from employees" "and not the profiles themselves (the owner's alone)"
check $MARCUS "0" "select count(*) from payroll_people('$O') p where row_to_json(p)::text ~ '24|@'" "no pay rate, no email"

# ---- the payroll settings
check $MARCUS "weekly|2026-11-02|0|true|45|true|8|lead|true|Marcus" "select concat_ws('|', r->>'freq', r->>'anchor', r->>'weekStart', r->>'otWeekOn', r->>'otWeek', r->>'otDayOn', r->>'otDay', r->>'tips', r->>'set', r->>'by') from hr_payroll_set('$O', '{\"freq\":\"weekly\",\"anchor\":\"2026-11-02\",\"weekStart\":0,\"otWeekOn\":true,\"otWeek\":45,\"otDayOn\":true,\"otDay\":8,\"tips\":\"lead\",\"junk\":\"x\"}') r" "HR saves the payroll settings"
check $OWN "weekly|lead|false|Ace Moving" "select concat_ws('|', data->'payroll'->>'freq', data->'payroll'->>'tips', (data->'payroll' ? 'junk')::text, data->>'company') from docs where path='org/settings'" "in the settings, without anything it doesn't know, the rest as it was"
check $MARCUS "biweekly||1|true|40|false|8|hours" "select concat_ws('|', r->>'freq', r->>'anchor', r->>'weekStart', r->>'otWeekOn', r->>'otWeek', r->>'otDayOn', r->>'otDay', r->>'tips') from hr_payroll_set('$O', '{\"freq\":\"daily\",\"anchor\":\"2026-02-31\",\"weekStart\":\"x\",\"otWeekOn\":\"yes\",\"otWeek\":900,\"otDayOn\":1,\"otDay\":-1,\"tips\":\"cash\"}') r" "what doesn't make sense goes back to the defaults"
says $RILEY "select hr_payroll_set('$O', '{\"freq\":\"weekly\"}')" "Only HR can change payroll settings" "the crew can't"
says $DIS "select hr_payroll_set('$O', '{\"freq\":\"weekly\"}')" "Only HR can change payroll settings" "nor dispatch without HR"
check $OWN "monthly" "select r->>'freq' from hr_payroll_set('$O', '{\"freq\":\"monthly\"}') r" "the owner can too"

# ---- a tip split by hand
check $MARCUS "40|20|60.00|Marcus" "select concat_ws('|', r->'amts'->>'Riley', r->'amts'->>'Dee', r->>'total', r->>'by') from hr_tip_split('$O', 'j1', '{\"Riley\":40,\"Dee\":20}') r" "HR splits a job's tip"
check $OWN "40|20|60.00" "select concat_ws('|', data->'tipSplit'->'amts'->>'Riley', data->'tipSplit'->'amts'->>'Dee', data->'tipSplit'->>'total') from docs where path='jobs/j1'" "it's on the job"
says $MARCUS "select hr_tip_split('$O', 'j1', '{\"Riley\":-5}')" "Each share is a name and an amount" "no share below zero"
says $MARCUS "select hr_tip_split('$O', 'j1', '{\"Riley\":\"lots\"}')" "Each share is a name and an amount" "a share is an amount"
says $MARCUS "select hr_tip_split('$O', 'j1', '{}')" "Each share is a name and an amount" "and there is one"
says $MARCUS "select hr_tip_split('$O', 'nope', '{\"Riley\":5}')" "No such job" "on a job that's there"
says $MARCUS "select hr_tip_split('$O2', 'z1', '{\"Riley\":5}')" "Only HR" "of his own company"
says $RILEY "select hr_tip_split('$O', 'j1', '{\"Riley\":60}')" "Only HR" "the crew can't"
# on the job itself: the office, HR or a lead on it
check $RILEY "1" "update docs set data = jsonb_set(data, '{tipSplit}', '{\"amts\":{\"Riley\":60},\"total\":60,\"by\":\"Riley\"}') where path='jobs/j1' returning 1" "a crew member on the job saves the job"
check $OWN "40" "select data->'tipSplit'->'amts'->>'Riley' from docs where path='jobs/j1'" "but the tip split stays as it was"
check $RILEY "1" "update docs set data = data - 'tipSplit' where path='jobs/j1' returning 1" "taking it out doesn't work either"
check $OWN "40" "select data->'tipSplit'->'amts'->>'Riley' from docs where path='jobs/j1'" "it's still there"
check $DEE "1" "update docs set data = jsonb_set(data, '{tipSplit}', '{\"amts\":{\"Riley\":30,\"Dee\":30},\"total\":60,\"by\":\"Dee\"}') where path='jobs/j1' returning 1" "the lead on the job splits it"
check $OWN "30|Dee" "select (data->'tipSplit'->'amts'->>'Riley')||'|'||(data->'tipSplit'->>'by') from docs where path='jobs/j1'" "and it's saved"
check $DIS "1" "update docs set data = jsonb_set(data, '{tipSplit,by}', '\"Dispatch\"') where path='jobs/j1' returning 1" "the office can"
check $OWN "Dispatch" "select data->'tipSplit'->>'by' from docs where path='jobs/j1'" "saved"
check $RILEY "1" "update docs set data = jsonb_set(data, '{d,notes}', '\"Gate 4411\"') where path='jobs/j1' returning 1" "the crew's other changes to the job go in as before"
check $OWN "Gate 4411|Dispatch" "select (data->'d'->>'notes')||'|'||(data->'tipSplit'->>'by') from docs where path='jobs/j1'" "with the split untouched"
pg "update docs set data = data - 'tipSplit' where path='jobs/j3'" >/dev/null
check $RILEY "false" "update docs set data = jsonb_set(data, '{tipSplit}', '{\"amts\":{\"Riley\":5}}') where path='jobs/j3' returning (data ? 'tipSplit')::text" "a crew member can't add one where there was none"

# ---- a payroll ID
check $MARCUS "Riley|R-7" "select (r->>'name')||'|'||(r->>'payroll_id') from hr_payroll_id('$O', 'riley', ' R-7 ') r" "HR puts in someone's payroll ID"
check $OWN "R-7|Hourly" "select (info->>'payrollId')||'|'||(info->>'payType') from employees where name='Riley'" "on their profile, the rest as it was"
check $MARCUS "Riley|" "select (r->>'name')||'|'||(r->>'payroll_id') from hr_payroll_id('$O', 'Riley', '') r" "an empty one takes it out"
check $OWN "false" "select (info ? 'payrollId')::text from employees where name='Riley'" "gone"
says $MARCUS "select hr_payroll_id('$O', 'Riley', '<script>')" "up to 40 letters" "letters, numbers and a few marks only"
says $MARCUS "select hr_payroll_id('$O', 'Nobody', 'X1')" "No profile for that name" "a profile that's there"
says $RILEY "select hr_payroll_id('$O', 'Riley', 'X1')" "Only HR" "the crew can't"

# ---- signed out
says "" "select hr_payroll_set('$O', '{}')" "Only HR" "with no sign-in behind it, nothing"
got=$($P -d t -tA -c "set role anon; select public.payroll_people('$O')" 2>&1 | tail -1); case "$got" in *"permission denied"*) echo "PASS anon can't ask for the payroll details";; *) echo "FAIL anon: $got"; FAILS=1;; esac

# ---- the rules are the base files' rules
R1=$(rules)
$P -d t -f supabase/sql/supabase-callcenter.sql
same "$(rules)" "$R1" "running supabase-callcenter.sql again leaves HR's rules exactly as they are"
$P -d t -f supabase/sql/supabase-payroll.sql
same "$(rules)" "$R1" "and supabase-payroll.sql again too"

echo; [ $FAILS -eq 0 ] && echo "payroll sql: all passed" || echo "payroll sql: SOMETHING FAILED"
exit $FAILS
