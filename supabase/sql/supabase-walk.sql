-- MoveCrew: walk-through video calls (Sales, batch 7, Nov 19). Run after supabase-schema-v2.sql. Safe to run again.
--
-- Richie: "The walk through videos should be saved to the crew notes so they can veiw it and see what they are in
-- for"; then "MoveCrew runs the call" and "Delete 30 days after move".
--
-- walk-videos    a private storage bucket: <company id>/<job id>/<call>-<part>.mp4 (or .webm), 50 MB a file at most
--                (the free plan's largest). Nobody signed in reads or writes it directly: the Edge Function
--                (tally-twilio) hands out a link to put one part in, or to watch one, after checking who's asking,
--                and takes a video out 30 days after its move was paid.
-- walk_rooms     one row per job while its walk-through call is set up: the room (a hash of the code in the
--                customer's link), when the host and the customer were last there, and the call's offer and answer.
--                Only the Edge Function (the service role) reads or writes it.
-- walk_space()   how much the walk-through videos take, and all the files together, for the function's guard: new
--                videos stop before the storage fills (WALK_CAP_MB, 800 to start; the free plan has 1 GB in all).

create table if not exists public.walk_rooms (
  org_id      uuid not null references public.orgs(id) on delete cascade,
  job_id      text not null check (length(job_id) between 1 and 40),
  room        text not null,
  host_uid    uuid,
  host_name   text not null default '',
  host_at     timestamptz,
  cust_at     timestamptz,
  offer       jsonb,
  offer_seq   integer not null default 0,
  answer      jsonb,
  answer_seq  integer not null default 0,
  ended_at    timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (org_id, job_id)
);
alter table public.walk_rooms enable row level security;   -- no policies: the Edge Function only
revoke all on public.walk_rooms from anon, authenticated;
grant all on public.walk_rooms to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('walk-videos', 'walk-videos', false, 52428800, array['video/mp4','video/webm'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.walk_space() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'walk', coalesce(sum((o.metadata->>'size')::bigint) filter (where o.bucket_id = 'walk-videos'), 0),
    'all',  coalesce(sum((o.metadata->>'size')::bigint), 0))
  from storage.objects o
$$;
revoke all on function public.walk_space() from public, anon, authenticated;
grant execute on function public.walk_space() to service_role;
