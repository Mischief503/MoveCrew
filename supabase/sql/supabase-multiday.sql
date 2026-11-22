-- MoveCrew, batch 10 (Nov 22): moves over more than one day.
-- The schedule's copy of a job (what the call center reads) keeps the job's days after the first (d.days), so the
-- call center's day plan sees a move on each of its days, its truck held overnight. Safe to run again.
-- Run once on a database set up with supabase-callcenter.sql (or supabase-schema-v2.sql); it changes sched_of and
-- brings the copies of the booked and running jobs up to date. Nothing else changes.
create or replace function public.sched_of(j jsonb) returns jsonb
language sql immutable set search_path = public as $$
  select jsonb_build_object(
    'id', j->'id', 'status', j->'status', 'test', coalesce(j->'test', 'false'::jsonb),
    'd', jsonb_build_object('name', j->'d'->'name', 'phone', j->'d'->'phone', 'email', j->'d'->'email',
           'moveDate', j->'d'->'moveDate', 'time', j->'d'->'time', 'from', j->'d'->'from', 'to', j->'d'->'to',
           'notes', j->'d'->'notes', 'flights', j->'d'->'flights', 'custom', j->'d'->'custom', 'slots', j->'d'->'slots', 'days', j->'d'->'days'),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', i->'id', 'name', i->'name', 'qty', i->'qty'))
                         from jsonb_array_elements(case when jsonb_typeof(j->'items') = 'array' then j->'items' else '[]'::jsonb end) i),
                      '[]'::jsonb),
    'quote', jsonb_build_object('crew', j->'quote'->'crew', 'hours', j->'quote'->'hours', 'kind', j->'quote'->'kind',
           'driveH', j->'quote'->'driveH', 'nTrucks', j->'quote'->'nTrucks', 'truckId', j->'quote'->'truckId',
           'truckName', j->'quote'->'truckName'),
    'assign', jsonb_build_object('truckId', j->'assign'->'truckId', 'more', coalesce(j->'assign'->'more', '[]'::jsonb),
           'crewN', case when jsonb_typeof(j->'assign'->'crew') = 'array' then jsonb_array_length(j->'assign'->'crew') else 0 end),
    'startedAt', j->'startedAt')
$$;
-- the copies already there, again with their days
insert into public.docs(org_id, path, collection, doc_id, data, updated_at)
select org_id, 'sched/' || doc_id, 'sched', doc_id, public.sched_of(data), now() from public.docs
 where collection = 'jobs' and coalesce(data->>'status', '') in ('booked','active')
on conflict (org_id, path) do update set data = excluded.data, updated_at = excluded.updated_at
  where public.docs.data is distinct from excluded.data;
