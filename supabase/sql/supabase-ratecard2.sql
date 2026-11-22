-- MoveCrew, Nov 22: the call center's copy of the rate card (ratecard/main, made by ratecard_of on every save of the
-- settings) also carries a packing day's boxes an hour and price a box (packRate, boxPrice: batch 9) and the fee for a
-- truck held overnight on a move over more than one day (nightFee: batch 10), so the call center's quotes match the
-- company's. Safe to run again. Run once on a database set up with supabase-callcenter.sql (or
-- supabase-schema-v2.sql); it changes ratecard_of and brings the copies there up to date. Nothing else changes.
create or replace function public.ratecard_of(s jsonb) returns jsonb
language sql immutable set search_path = public as $$
  select coalesce(jsonb_object_agg(k, s->k), '{}'::jsonb)
         || case when jsonb_typeof(s->'crew') = 'array' then jsonb_build_object('movers', jsonb_build_object(
              'n', jsonb_array_length(s->'crew'),
              'off', (select coalesce(jsonb_object_agg(o.day, o.n), '{}'::jsonb) from (
                        select d.key as day, count(distinct x.name) as n
                          from jsonb_each(case when jsonb_typeof(s->'daysOff') = 'object' then s->'daysOff' else '{}'::jsonb end) d
                          cross join lateral jsonb_array_elements_text(case when jsonb_typeof(d.value) = 'array' then d.value else '[]'::jsonb end) x(name)
                         where s->'crew' ? x.name
                         group by d.key) o)))
            else '{}'::jsonb end
    from unnest(array['company','rates','minHours','prod','mph','shopAddress','shopTravel','shopGeo','includedMiles',
                      'mileRate','truckFee','stairFee','packPerBox','taxPct','depositPct','ntePct','nteCap','trucks',
                      'catalog','sources','customFields','opt','truckDay','quoteDays','callScript','packRate','boxPrice',
                      'nightFee']) as k
   where s ? k
$$;
revoke all on function public.ratecard_of(jsonb) from public, anon, authenticated;
-- the copies already there, again with the new numbers
insert into public.docs(org_id, path, collection, doc_id, data, updated_at)
select org_id, 'ratecard/main', 'ratecard', 'main', public.ratecard_of(data), now() from public.docs
 where path = 'org/settings'
on conflict (org_id, path) do update set data = excluded.data, updated_at = excluded.updated_at
  where public.docs.data is distinct from excluded.data;
