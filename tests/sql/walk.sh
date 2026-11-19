#!/usr/bin/env bash
# Walk-through video calls (supabase-walk.sql, Nov 19): the call's room table is closed to the app (only the Edge
# Function reads and writes it), one row per job, gone with its company; the private walk-videos bucket takes video
# files of 50 MB at most; walk_space() adds up the walk-through videos and all the files, and only the function may
# ask. The file runs twice cleanly. Supabase's default grants come first, so "closed" means what it means on the real
# project.
set -e
PGBIN=$(ls -d /usr/lib/postgresql/*/bin | head -1)
D=$(mktemp -d); $PGBIN/initdb -D $D -U postgres >/dev/null
$PGBIN/pg_ctl -D $D -o "-k $D -p 55441 -c listen_addresses=''" -l $D/log start >/dev/null
trap '$PGBIN/pg_ctl -D $D stop >/dev/null' EXIT
P="psql -h $D -p 55441 -U postgres -v ON_ERROR_STOP=1 -q"
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
create schema storage;
create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid default auth.uid(), metadata jsonb, created_at timestamptz default now());
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated, service_role;
insert into auth.users values ('cccccccc-0000-0000-0000-000000000001','own@x.com', now()), ('cccccccc-0000-0000-0000-000000000002','other@x.com', now());
SQL
$P -d t -f supabase/sql/supabase-schema-v2.sql
$P -d t -f supabase/sql/supabase-employees.sql
$P -d t -f supabase/sql/supabase-walk.sql
$P -d t -f supabase/sql/supabase-walk.sql   # runs again cleanly
OWN=cccccccc-0000-0000-0000-000000000001; OTHER=cccccccc-0000-0000-0000-000000000002
as(){ $P -d t -tA -c "set role authenticated; set request.jwt.claim.sub='$1'; $2" 2>&1 | tail -1; }
srv(){ $P -d t -tA -c "set role service_role; $1" 2>&1 | tail -1; }
srvall(){ $P -d t -tA -c "set role service_role; $1" 2>&1 | tr '\n' ' '; }
FAILS=0
same(){ if [ "$1" = "$2" ]; then echo "PASS $3"; else echo "FAIL $3: got '$1' want '$2'"; FAILS=1; fi; }
has(){ case "$1" in *"$2"*) echo "PASS $3";; *) echo "FAIL $3: got '$1'"; FAILS=1;; esac; }

O=$(as $OWN "select public.create_org('Ace Moving')")
O2=$(as $OTHER "select public.create_org('Bright Moves')")

# ---- the room table: closed to the app
same "$($P -d t -tA -c "select relrowsecurity from pg_class where relname='walk_rooms'")" "t" "row-level security is on"
same "$($P -d t -tA -c "select count(*) from pg_policies where tablename='walk_rooms'")" "0" "with no rules for anyone signed in"
has "$(as $OWN "select count(*) from walk_rooms")" "permission denied" "the owner can't read a call's room from the app"
has "$($P -d t -tA -c "set role anon; select count(*) from walk_rooms" 2>&1 | tail -1)" "permission denied" "nor can a customer, or anyone signed out"
has "$(as $OWN "insert into walk_rooms(org_id,job_id,room) values ('$O','j1','x')")" "permission denied" "nor make one up"

# ---- the Edge Function (service role): one row per job
same "$(srv "insert into walk_rooms(org_id,job_id,room,host_name) values ('$O','j1','abc','Dee') returning offer_seq||','||answer_seq||','||(ended_at is null)")" "0,0,true" "a room: no offer or answer yet, not ended"
has "$(srvall "insert into walk_rooms(org_id,job_id,room) values ('$O','j1','def')")" "walk_rooms_pkey" "one room per job"
same "$(srv "insert into walk_rooms(org_id,job_id,room,cust_at) values ('$O','j1','def',now()) on conflict (org_id,job_id) do update set room=excluded.room, cust_at=excluded.cust_at returning room||','||host_name")" "def,Dee" "the function's upsert changes only what it sends"
same "$(srv "update walk_rooms set offer='{\"sdp\":\"v=0\"}', offer_seq=1 where job_id='j1' returning offer->>'sdp'")" "v=0" "the offer waits there"
has "$(srvall "insert into walk_rooms(org_id,job_id,room) values ('$O','$(printf 'x%.0s' {1..41})','r')")" "walk_rooms_job_id_check" "a job id is 40 letters at most"
same "$(srv "insert into walk_rooms(org_id,job_id,room) values ('$O2','j1','abc') returning org_id")" "$O2" "another company's job j1 has its own room"

# ---- the bucket
same "$($P -d t -tA -c "select public||','||file_size_limit||','||array_to_string(allowed_mime_types,' ') from storage.buckets where id='walk-videos'")" "false,52428800,video/mp4 video/webm" "walk-videos: private, 50 MB a file, MP4 or WebM"
same "$($P -d t -tA -c "select count(*) from pg_policies where schemaname='storage' and tablename='objects' and (qual like '%walk-videos%' or with_check like '%walk-videos%')")" "0" "no storage rules for it: the function hands out its links"

# ---- walk_space(): the function's guard
$P -d t -c "insert into storage.objects(bucket_id,name,metadata) values ('walk-videos','$O/j1/c1-1.mp4','{\"size\":30000000}'),('walk-videos','$O/j1/c1-2.mp4','{\"size\":12000000}'),('employee-docs','$O/e1/id.pdf','{\"size\":1000000}'),('employee-docs','$O/e1/x.pdf',null)"
same "$(srv "select public.walk_space()->>'walk'||','||(public.walk_space()->>'all')")" "42000000,43000000" "the walk-through videos, and all the files"
has "$(as $OWN "select public.walk_space()")" "permission denied" "the app can't ask"
has "$($P -d t -tA -c "set role anon; select public.walk_space()" 2>&1 | tail -1)" "permission denied" "nor anyone signed out"

# ---- a company that goes takes its rooms with it
$P -d t -c "delete from orgs where id='$O2'"
same "$(srv "select count(*) from walk_rooms where org_id='$O2'")" "0" "deleting a company deletes its rooms"

echo; [ $FAILS -eq 0 ] && echo "walk sql: all passed" || echo "walk sql: SOMETHING FAILED"
exit $FAILS
