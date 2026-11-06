-- Pair Planner: paired users can READ partner vehicles/goals/links;
-- goal owners may LINK partner vehicles to their own goals.
-- Writes/deletes on partner rows stay owner-only. Contributions stay own-only.

-- ---------------------------------------------------------------------------
-- Helpers (security definer; used by RLS policies)
-- ---------------------------------------------------------------------------
create or replace function public._partner_peer_user_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_peer uuid;
begin
  if auth.uid() is null then
    return null;
  end if;

  select case
    when pl.user_a = auth.uid() then pl.user_b
    else pl.user_a
  end
  into v_peer
  from public.partner_links pl
  where pl.status = 'active'
    and (pl.user_a = auth.uid() or pl.user_b = auth.uid())
  limit 1;

  return v_peer;
end;
$$;

comment on function public._partner_peer_user_id() is
  'Active partner uuid for auth.uid(), or null when solo / unauthenticated.';

revoke all on function public._partner_peer_user_id() from public, anon;
grant execute on function public._partner_peer_user_id() to authenticated;

create or replace function public._is_active_partner_of(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_user is not null
    and public._partner_peer_user_id() is not null
    and p_user = public._partner_peer_user_id();
$$;

comment on function public._is_active_partner_of(uuid) is
  'True when p_user is the active partner of auth.uid().';

revoke all on function public._is_active_partner_of(uuid) from public, anon;
grant execute on function public._is_active_partner_of(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- planner_vehicles: partner may SELECT (not write)
-- ---------------------------------------------------------------------------
drop policy if exists "planner_vehicles_select_own" on public.planner_vehicles;
drop policy if exists "planner_vehicles_select_own_or_partner" on public.planner_vehicles;
create policy "planner_vehicles_select_own_or_partner"
  on public.planner_vehicles
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or public._is_active_partner_of(user_id)
  );

-- ---------------------------------------------------------------------------
-- planner_goals: partner may SELECT (not write)
-- ---------------------------------------------------------------------------
drop policy if exists "planner_goals_select_own" on public.planner_goals;
drop policy if exists "planner_goals_select_own_or_partner" on public.planner_goals;
create policy "planner_goals_select_own_or_partner"
  on public.planner_goals
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or public._is_active_partner_of(user_id)
  );

-- ---------------------------------------------------------------------------
-- planner_goal_vehicles: partner may SELECT; owner may link partner vehicles
-- ---------------------------------------------------------------------------
drop policy if exists "planner_goal_vehicles_select_own" on public.planner_goal_vehicles;
drop policy if exists "planner_goal_vehicles_select_own_or_partner"
  on public.planner_goal_vehicles;
create policy "planner_goal_vehicles_select_own_or_partner"
  on public.planner_goal_vehicles
  for select
  to authenticated
  using (
    auth.uid() = user_id
    or public._is_active_partner_of(user_id)
  );

drop policy if exists "planner_goal_vehicles_insert_own" on public.planner_goal_vehicles;
drop policy if exists "planner_goal_vehicles_insert_own_goal" on public.planner_goal_vehicles;
create policy "planner_goal_vehicles_insert_own_goal"
  on public.planner_goal_vehicles
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.planner_goals g
      where g.id = goal_id
        and g.user_id = auth.uid()
        and g.deleted_at is null
    )
    and exists (
      select 1
      from public.planner_vehicles v
      where v.id = vehicle_id
        and v.deleted_at is null
        and (
          v.user_id = auth.uid()
          or public._is_active_partner_of(v.user_id)
        )
    )
  );

-- Delete stays owner-only (goal owner’s link rows).
-- Contributions / vehicle & goal writes unchanged (owner-only).
