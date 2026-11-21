-- MoveCrew: payroll (batch 8, Nov 20, 2026). Run after supabase-schema-v2.sql, supabase-employees.sql and
-- supabase-callcenter.sql, in the SQL editor. Safe to run again. Nothing here removes or rewrites your jobs, people or
-- settings.
--
-- HR is the owner, and anyone with the HR switch on their profile (Setup › Employees): the app keeps their names in
-- the settings' `hr` list, which only the owner writes. What it adds:
--   * hr_of(company): do I have HR there? (also in supabase-schema-v2.sql, so running that again keeps it)
--   * HR reads every clock row and fixes them (docs_read and can_write_doc, as in supabase-schema-v2.sql). A wrong
--     clock row is voided by the app, not deleted, so the record stays.
--   * payroll_jobs(company, from, to): the jobs of a pay period, for HR who don't read every job already (the office
--     does): worked in those days (finished, paid or still running) or paid in them (tips and commission)
--   * payroll_people(company): each profile's payroll ID, worker type and pay type, for HR who aren't the owner (only
--     the owner reads the profiles themselves)
--   * hr_payroll_set(company, settings): how often the company pays, the workweek, overtime and tips (the settings'
--     `payroll`; the owner saves them with the rest of the settings)
--   * hr_tip_split(company, job, shares): a job's tip split by hand, when the crew lead splits tips
--   * hr_payroll_id(company, name, id): a person's ID at the payroll company, on their profile
--   * tips_guard: on a job, only the office, HR or a crew lead on it changes the tip split (j.tipSplit)
-- Each function checks hr_of first.

-- ---------- who has HR ----------
create or replace function public.hr_of(o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.role_in(o) = 'owner', false)
      or exists (select 1 from public.members m join public.docs s on s.org_id = m.org_id and s.path = 'org/settings'
                  where m.org_id = o and m.user_id = auth.uid() and m.staff <> ''
                    and jsonb_typeof(s.data->'hr') = 'array' and (s.data->'hr') ? m.staff)
$$;
revoke all on function public.hr_of(uuid) from public, anon;
grant execute on function public.hr_of(uuid) to authenticated;

-- ---------- HR reads and fixes the clock rows (the same rules as supabase-schema-v2.sql's docs-rules) ----------
alter policy docs_read on public.docs using (
  (public.member_of(org_id) and (
    public.office_of(org_id)
    or collection in ('org','meta','chat','locs','photos','formpages')
    or (collection = 'jobs'   and public.on_job(org_id, data))
    or (collection = 'vault'  and public.role_in(org_id) = 'lead')
    or (collection = 'shifts' and (public.role_in(org_id) = 'lead' or data->>'who' = public.staff_in(org_id) or public.hr_of(org_id)))
  ))
  or (public.cc_in(org_id) and (
    collection in ('meta','ratecard','sched')
    or (collection = 'jobs' and public.cc_open(data))
  )));

create or replace function public.can_write_doc(o uuid, col text, d jsonb) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when not public.member_of(o) then false
    when col in ('org','meta')   then public.role_in(o) = 'owner'
    when col in ('sched','ratecard') then false
    when public.office_of(o)     then true
    when col = 'jobs'            then public.on_job(o, d)
    when col = 'vault'           then public.role_in(o) = 'lead'
    when col = 'shifts'          then public.role_in(o) = 'lead' or d->>'who' = public.staff_in(o) or public.hr_of(o)
    when col = 'locs'            then d->>'name' = public.staff_in(o)
    when col in ('chat','photos','formpages') then true
    else false end
$$;

-- ---------- a pay period's jobs ----------
-- Worked from f to t (by the move day, or the day it finished when it has none), or with a payment dated then. A day
-- either side for time zones; the app picks the days out. Ten weeks at most.
create or replace function public.payroll_jobs(o uuid, f date, t date) returns setof jsonb
language plpgsql stable security definer set search_path = public as $$
declare lo text; hi text;
begin
  if not public.hr_of(o) then raise exception 'Only HR can see payroll' using errcode = '42501'; end if;
  if f is null or t is null or t < f or t - f > 70 then raise exception 'Pick up to 10 weeks'; end if;
  lo := to_char(f - 1, 'YYYY-MM-DD'); hi := to_char(t + 1, 'YYYY-MM-DD');
  return query
    select d.data from public.docs d
     where d.org_id = o and d.collection = 'jobs' and coalesce(d.data->>'status', '') in ('active','done','paid')
       and (coalesce(nullif(d.data->'d'->>'moveDate', ''),
                     case when jsonb_typeof(d.data->'finishedAt') = 'number'
                          then to_char(to_timestamp((d.data->>'finishedAt')::double precision / 1000) at time zone 'UTC', 'YYYY-MM-DD') end)
              between lo and hi
            or exists (select 1 from jsonb_each(case when jsonb_typeof(d.data->'payments') = 'object' then d.data->'payments' else '{}'::jsonb end) p
                        where jsonb_typeof(p.value) = 'object' and (p.value->>'date') between lo and hi));
end $$;

-- ---------- the profiles' payroll details ----------
create or replace function public.payroll_people(o uuid)
returns table(name text, payroll_id text, worker_type text, pay_type text, active boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.hr_of(o) then raise exception 'Only HR can see payroll' using errcode = '42501'; end if;
  return query
    select e.name, coalesce(e.info->>'payrollId', ''), coalesce(e.info->>'workerType', ''), coalesce(e.info->>'payType', ''), e.active
      from public.employees e where e.org_id = o order by lower(e.name);
end $$;

-- ---------- the payroll settings ----------
-- Only what the app knows goes in, checked; anything else in p is left out.
create or replace function public.hr_payroll_set(o uuid, p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare c jsonb; a text; n numeric;
begin
  if not public.hr_of(o) then raise exception 'Only HR can change payroll settings' using errcode = '42501'; end if;
  if p is null or jsonb_typeof(p) <> 'object' then raise exception 'Nothing to save'; end if;
  a := coalesce(p->>'anchor', '');
  if a !~ '^\d{4}-\d\d-\d\d$' then a := ''; end if;
  if a <> '' then begin perform a::date; exception when others then a := ''; end; end if;
  c := jsonb_build_object(
    'freq', case when p->>'freq' in ('weekly','biweekly','semimonthly','monthly') then p->>'freq' else 'biweekly' end,
    'anchor', a,
    'weekStart', case when jsonb_typeof(p->'weekStart') <> 'number' then 1
                      when (p->>'weekStart')::numeric between 0 and 6 then floor((p->>'weekStart')::numeric)::int else 1 end,
    'otWeekOn', case when jsonb_typeof(p->'otWeekOn') = 'boolean' then (p->'otWeekOn')::text::boolean else true end,
    'otDayOn', case when jsonb_typeof(p->'otDayOn') = 'boolean' then (p->'otDayOn')::text::boolean else false end,
    'tips', case when p->>'tips' in ('hours','even','lead','off') then p->>'tips' else 'hours' end,
    'set', true,
    'by', coalesce(nullif(public.staff_in(o), ''), 'HR'),
    'at', floor(extract(epoch from now()) * 1000));
  n := case when jsonb_typeof(p->'otWeek') = 'number' then (p->>'otWeek')::numeric end;
  c := c || jsonb_build_object('otWeek', case when n > 0 and n <= 168 then n else 40 end);
  n := case when jsonb_typeof(p->'otDay') = 'number' then (p->>'otDay')::numeric end;
  c := c || jsonb_build_object('otDay', case when n > 0 and n <= 24 then n else 8 end);
  update public.docs set data = jsonb_set(data, '{payroll}', c, true), updated_at = now()
   where org_id = o and path = 'org/settings';
  if not found then raise exception 'This company has no settings yet'; end if;
  return c;
end $$;

-- ---------- a job's tip split by hand ----------
create or replace function public.hr_tip_split(o uuid, jid text, split jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare k text; v jsonb; n int := 0; tot numeric := 0; rec jsonb;
begin
  if not public.hr_of(o) then raise exception 'Only HR can split a tip here' using errcode = '42501'; end if;
  if coalesce(jid, '') !~ '^[A-Za-z0-9_-]{1,64}$'
     or not exists (select 1 from public.docs where org_id = o and path = 'jobs/' || jid) then
    raise exception 'No such job';
  end if;
  if split is null or jsonb_typeof(split) <> 'object' then raise exception 'Each share is a name and an amount'; end if;
  for k, v in select * from jsonb_each(split) loop
    if length(btrim(k)) not between 1 and 60 or jsonb_typeof(v) <> 'number' then
      raise exception 'Each share is a name and an amount';
    end if;
    if (v #>> '{}')::numeric < 0 or (v #>> '{}')::numeric > 100000 then raise exception 'Each share is a name and an amount'; end if;
    n := n + 1; tot := tot + (v #>> '{}')::numeric;
  end loop;
  if n = 0 or n > 30 then raise exception 'Each share is a name and an amount'; end if;
  rec := jsonb_build_object('amts', split, 'total', round(tot, 2), 'by', coalesce(nullif(public.staff_in(o), ''), 'HR'),
                            'at', floor(extract(epoch from now()) * 1000));
  update public.docs set data = jsonb_set(data, '{tipSplit}', rec, true), updated_at = now()
   where org_id = o and path = 'jobs/' || jid;
  return rec;
end $$;

-- ---------- a person's payroll ID ----------
create or replace function public.hr_payroll_id(o uuid, emp text, pid text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare v text := btrim(coalesce(pid, '')); e public.employees;
begin
  if not public.hr_of(o) then raise exception 'Only HR can change payroll IDs' using errcode = '42501'; end if;
  if length(v) > 40 or v !~ '^[A-Za-z0-9 ._#/-]*$' then
    raise exception 'A payroll ID is up to 40 letters, numbers, spaces and . _ # / -';
  end if;
  update public.employees
     set info = case when v = '' then info - 'payrollId' else jsonb_set(info, '{payrollId}', to_jsonb(v), true) end
   where org_id = o and lower(name) = lower(btrim(coalesce(emp, '')))
  returning * into e;
  if e.id is null then raise exception 'No profile for that name'; end if;
  return jsonb_build_object('name', e.name, 'payroll_id', coalesce(e.info->>'payrollId', ''));
end $$;

revoke all on function public.payroll_jobs(uuid, date, date), public.payroll_people(uuid), public.hr_payroll_set(uuid, jsonb),
  public.hr_tip_split(uuid, text, jsonb), public.hr_payroll_id(uuid, text, text) from public, anon;
grant execute on function public.payroll_jobs(uuid, date, date), public.payroll_people(uuid), public.hr_payroll_set(uuid, jsonb),
  public.hr_tip_split(uuid, text, jsonb), public.hr_payroll_id(uuid, text, text) to authenticated;

-- ---------- the tip split on a job: the office, HR, or a crew lead on the job ----------
-- Anyone else's change to it (a crew member on the job, who may write the rest) is put back as it was.
create or replace function public.tips_guard() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;   -- the server (service role) and the SQL editor
  if (new.data -> 'tipSplit') is distinct from (old.data -> 'tipSplit')
     and not public.office_of(new.org_id) and not public.hr_of(new.org_id)
     and not (public.role_in(new.org_id) = 'lead' and public.on_job(new.org_id, old.data)) then
    new.data := case when old.data ? 'tipSplit' then jsonb_set(new.data, '{tipSplit}', old.data -> 'tipSplit') else new.data - 'tipSplit' end;
  end if;
  return new;
end $$;
revoke all on function public.tips_guard() from public, anon, authenticated;
create or replace trigger tips_guard before update on public.docs
  for each row when (new.collection = 'jobs') execute function public.tips_guard();
