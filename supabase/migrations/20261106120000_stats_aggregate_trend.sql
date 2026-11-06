-- Pair Trend: same metric/bucket window as stats_personal_trend, summed for
-- both linked members. Aggregates only — never partner txn rows/notes.
-- Buckets use the caller's profile TZ (aligns with resolveTrendBounds UI).
-- Recurring visibility uses each member's profile TZ (like stats_aggregate_*).
-- Transfers are excluded from spent/earned/net the same way as personal
-- (expense|income type filter; net sums only income − expense).
-- Founder: npx supabase db push

create or replace function public.stats_aggregate_trend(
  p_metric text,
  p_start timestamptz,
  p_end timestamptz,
  p_bucket text
)
returns table (
  bucket_start timestamptz,
  total numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_a uuid;
  v_b uuid;
  v_trunc text;
  v_tz text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_metric is null or p_metric not in ('expense', 'income', 'net') then
    raise exception 'p_metric must be expense, income, or net';
  end if;
  if p_bucket is null or p_bucket not in ('day', 'week', 'month', 'year') then
    raise exception 'p_bucket must be day, week, month, or year';
  end if;
  if p_start is null or p_end is null or p_end <= p_start then
    raise exception 'Invalid period bounds';
  end if;

  select member_a, member_b into v_a, v_b
  from public._partner_active_member_ids();

  if v_a is null or v_b is null then
    raise exception 'Not paired';
  end if;

  select coalesce(nullif(trim(p.timezone), ''), 'UTC')
  into v_tz
  from public.profiles p
  where p.id = auth.uid();
  v_tz := coalesce(v_tz, 'UTC');

  v_trunc := p_bucket;

  return query
  with scoped as (
    select
      (date_trunc(v_trunc, t.occurred_at at time zone v_tz) at time zone v_tz)
        as bucket_start,
      t.type,
      t.amount
    from public.transactions t
    join public.profiles p on p.id = t.user_id
    where t.user_id in (v_a, v_b)
      and t.deleted_at is null
      and t.occurred_at >= p_start
      and t.occurred_at < p_end
      and (
        t.recurring_series_id is null
        or (t.occurred_at at time zone coalesce(nullif(trim(p.timezone), ''), 'UTC'))::date
           <= (now() at time zone coalesce(nullif(trim(p.timezone), ''), 'UTC'))::date
      )
      and (
        p_metric = 'net'
        or t.type = p_metric
      )
  ),
  aggregated as (
    select
      s.bucket_start,
      case
        when p_metric = 'net' then
          coalesce(sum(s.amount) filter (where s.type = 'income'), 0)
          - coalesce(sum(s.amount) filter (where s.type = 'expense'), 0)
        else
          coalesce(sum(s.amount), 0)
      end::numeric as total
    from scoped s
    group by s.bucket_start
  )
  select a.bucket_start, a.total
  from aggregated a
  order by a.bucket_start asc;
end;
$$;

comment on function public.stats_aggregate_trend(text, timestamptz, timestamptz, text) is
  'M4 pair trend for both members; p_bucket day|week|month|year; caller TZ buckets; aggregates only';

grant execute on function public.stats_aggregate_trend(text, timestamptz, timestamptz, text)
  to authenticated;

revoke all on function public.stats_aggregate_trend(text, timestamptz, timestamptz, text)
  from public;
