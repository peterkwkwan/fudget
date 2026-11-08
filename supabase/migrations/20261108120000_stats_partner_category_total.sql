-- Pair category drill-down: one sum + count for the partner in a single
-- category. The caller still lists their own rows through RLS.
-- Aggregates only — never partner txn ids, notes, dates, or amounts.
-- Recurring visibility uses the partner's profile timezone, matching
-- stats_aggregate_by_category, so this sum is that partner's share of
-- the combined category total.
-- Founder: npx supabase db push --linked

create or replace function public.stats_partner_category_total(
  p_type text,
  p_category text,
  p_start timestamptz,
  p_end timestamptz
)
returns table (
  sum numeric,
  count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_a uuid;
  v_b uuid;
  v_partner uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_type is null or p_type not in ('expense', 'income') then
    raise exception 'p_type must be expense or income';
  end if;
  if p_category is null or length(trim(p_category)) = 0 then
    raise exception 'p_category is required';
  end if;
  if p_start is null or p_end is null or p_end <= p_start then
    raise exception 'Invalid period bounds';
  end if;

  select member_a, member_b into v_a, v_b
  from public._partner_active_member_ids();

  if v_a is null or v_b is null then
    raise exception 'Not paired';
  end if;

  v_partner := case
    when auth.uid() = v_a then v_b
    else v_a
  end;

  return query
  select
    coalesce(sum(t.amount), 0)::numeric as sum,
    count(*)::bigint as count
  from public.transactions t
  join public.profiles p on p.id = t.user_id
  where t.user_id = v_partner
    and t.deleted_at is null
    and t.type = p_type
    and t.category = p_category
    and t.occurred_at >= p_start
    and t.occurred_at < p_end
    and (
      t.recurring_series_id is null
      or (t.occurred_at at time zone coalesce(nullif(trim(p.timezone), ''), 'UTC'))::date
         <= (now() at time zone coalesce(nullif(trim(p.timezone), ''), 'UTC'))::date
    );
end;
$$;

comment on function public.stats_partner_category_total(text, text, timestamptz, timestamptz) is
  'Partner share of one category for the signed-in user; sum and count only — never txn rows';

grant execute on function public.stats_partner_category_total(text, text, timestamptz, timestamptz)
  to authenticated;

revoke all on function public.stats_partner_category_total(text, text, timestamptz, timestamptz)
  from public;
