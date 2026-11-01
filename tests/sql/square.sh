#!/usr/bin/env bash
# Square (supabase-square.sql, Nov 1): each company's Square connection is closed to the app (only the Edge
# Function reads it, and its tokens are sealed by the server), one current connection per company and mode, a
# pay link remembers its Square order, and a customer's page for a tip alone (amount 0) is allowed. The file runs
# twice cleanly. Supabase's default grants come first, so "closed" means what it means on the real project.
set -e
PGBIN=$(ls -d /usr/lib/postgresql/*/bin | head -1)
D=$(mktemp -d); $PGBIN/initdb -D $D -U postgres >/dev/null
$PGBIN/pg_ctl -D $D -o "-k $D -p 55439 -c listen_addresses=''" -l $D/log start >/dev/null
trap '$PGBIN/pg_ctl -D $D stop >/dev/null' EXIT
P="psql -h $D -p 55439 -U postgres -v ON_ERROR_STOP=1 -q"
$P -c "create database t"
$P -d t <<'SQL'
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
grant usage on schema auth, public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
create publication supabase_realtime;
insert into auth.users values ('cccccccc-0000-0000-0000-000000000001','own@x.com', now()), ('cccccccc-0000-0000-0000-000000000002','other@x.com', now());
SQL
$P -d t -f supabase/sql/supabase-schema-v2.sql
$P -d t -f supabase/sql/supabase-payments.sql
$P -d t -f supabase/sql/supabase-square.sql
$P -d t -f supabase/sql/supabase-square.sql   # runs again cleanly
OWN=cccccccc-0000-0000-0000-000000000001; OTHER=cccccccc-0000-0000-0000-000000000002
as(){ $P -d t -tA -c "set role authenticated; set request.jwt.claim.sub='$1'; $2" 2>&1 | tail -1; }
srv(){ $P -d t -tA -c "set role service_role; $1" 2>&1 | tail -1; }
srvall(){ $P -d t -tA -c "set role service_role; $1" 2>&1 | tr '\n' ' '; }
FAILS=0
same(){ if [ "$1" = "$2" ]; then echo "PASS $3"; else echo "FAIL $3: got '$1' want '$2'"; FAILS=1; fi; }
has(){ case "$1" in *"$2"*) echo "PASS $3";; *) echo "FAIL $3: got '$1'"; FAILS=1;; esac; }

O=$(as $OWN "select public.create_org('Ace Moving')")
O2=$(as $OTHER "select public.create_org('Bright Moves')")

# ---- closed to the app
same "$($P -d t -tA -c "select relrowsecurity from pg_class where relname='pay_square'")" "t" "row-level security is on"
has "$(as $OWN "select count(*) from pay_square")" "permission denied" "the owner can't read the connection (or its sealed tokens) from the app"
has "$($P -d t -tA -c "set role anon; select count(*) from pay_square" 2>&1 | tail -1)" "permission denied" "nor can anyone signed out"
has "$(as $OWN "insert into pay_square(org_id,merchant_id) values ('$O','MLRfake1')")" "permission denied" "nor make one up"

# ---- the Edge Function (service role)
same "$(srv "insert into pay_square(org_id,merchant_id,location_id,access_enc) values ('$O','MLR1aceAAA','L1','v1.x.y') returning status||','||active||','||is_current||','||livemode")" "ready,true,true,false" "a connection: ready, active, current, in the sandbox by default"
has "$(srvall "insert into pay_square(org_id,merchant_id) values ('$O','MLR2other')")" "pay_square_current_idx" "one current connection per company and mode"
same "$(srv "insert into pay_square(org_id,merchant_id,is_current) values ('$O','MLR2other',false) returning merchant_id")" "MLR2other" "an earlier connection stays on file, not current"
same "$(srv "insert into pay_square(org_id,merchant_id,livemode) values ('$O','MLR1aceAAA',true) returning livemode")" "t" "and live mode has its own"
same "$(srv "insert into pay_square(org_id,merchant_id) values ('$O2','MLR1aceAAA') returning org_id")" "$O2" "another company may connect the same Square seller"
has "$(srvall "insert into pay_square(org_id,merchant_id,is_current) values ('$O','bad id!',false)")" "pay_square_merchant_id_check" "a seller id that isn't one is refused"
has "$(srvall "update pay_square set status='maybe' where merchant_id='MLR2other'")" "pay_square_status_check" "only the known states"

# ---- pay links remember their Square order, and a tip alone is allowed
same "$(srv "insert into pay_links(token,org_id,job_id,session_id,url,amount_cents,expires_at) values ('abcd1234','$O','j1','cs_test_1','https://x',5000,now()+interval '1 day') returning meta::text")" "{}" "a Stripe link's meta starts empty"
same "$(srv "insert into pay_links(token,org_id,job_id,session_id,url,amount_cents,expires_at,account,meta) values ('sq123456','$O','j1','sqpl_test_PL1','https://square.link/u/1',5000,now()+interval '7 days','sq:MLR1aceAAA','{\"order_id\":\"ORD1\"}') returning token")" "sq123456" "a Square link keeps its order"
same "$(srv "select token from pay_links where meta->>'order_id'='ORD1'")" "sq123456" "and is found by it (a payment names its order)"
same "$($P -d t -tA -c "select count(*) from pg_indexes where indexname='pay_links_order_idx'")" "1" "with an index"
same "$(srv "insert into pay_links(token,org_id,job_id,session_id,url,amount_cents,expires_at,created_by) values ('ctip1234','$O','j1','cs_test_2','https://x',0,now()+interval '1 hour','customer (app)') returning amount_cents")" "0" "a customer's page for a tip alone counts 0 toward the bill"
has "$(srvall "insert into pay_links(token,org_id,job_id,session_id,url,amount_cents,expires_at) values ('neg12345','$O','j1','cs_test_3','https://x',-1,now())")" "pay_links_amount_cents_check" "never less than 0"
same "$(as $OWN "select count(*) from pay_links")" "0" "pay links stay closed to the app (the owner sees none of the three)"

# ---- a company that goes takes its connections with it
$P -d t -c "delete from orgs where id='$O2'"
same "$(srv "select count(*) from pay_square where org_id='$O2'")" "0" "deleting a company deletes its Square connection"

echo; [ $FAILS -eq 0 ] && echo "square sql: all passed" || echo "square sql: SOMETHING FAILED"
exit $FAILS
