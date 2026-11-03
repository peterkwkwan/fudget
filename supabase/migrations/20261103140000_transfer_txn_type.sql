-- Transfer as third transaction TYPE (Expense | Income | Transfer).
-- Schema: vehicle_id = From (also optional link for expense/income);
--         transfer_to_vehicle_id = To (Transfer only).
-- Founder: paste this file in Dashboard → SQL, or `npx supabase db push --linked`
-- (see docs/transfer-txn-type-apply.md in the Project store).

-- ---------------------------------------------------------------------------
-- Allow type = transfer
-- ---------------------------------------------------------------------------
alter table public.transactions
  drop constraint if exists transactions_type_valid;

alter table public.transactions
  add constraint transactions_type_valid
  check (type in ('expense', 'income', 'transfer'));

-- ---------------------------------------------------------------------------
-- transfer_to_vehicle_id → planner_vehicles (nullable; ON DELETE SET NULL)
-- ---------------------------------------------------------------------------
alter table public.transactions
  add column if not exists transfer_to_vehicle_id uuid
    references public.planner_vehicles (id) on delete set null;

comment on column public.transactions.vehicle_id is
  'Planner account: optional link for expense/income; From account for transfer';

comment on column public.transactions.transfer_to_vehicle_id is
  'To account for type=transfer; null for expense/income';

create index if not exists transactions_transfer_to_vehicle_id_idx
  on public.transactions (transfer_to_vehicle_id)
  where transfer_to_vehicle_id is not null;

-- Transfer requires distinct From/To; non-transfer must not set To.
alter table public.transactions
  drop constraint if exists transactions_transfer_accounts_valid;

alter table public.transactions
  add constraint transactions_transfer_accounts_valid check (
    (
      type = 'transfer'
      and vehicle_id is not null
      and transfer_to_vehicle_id is not null
      and vehicle_id <> transfer_to_vehicle_id
    )
    or (
      type in ('expense', 'income')
      and transfer_to_vehicle_id is null
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: both linked vehicles must belong to the same user (or be null)
-- ---------------------------------------------------------------------------
drop policy if exists "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own"
  on public.transactions
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and (
      vehicle_id is null
      or exists (
        select 1
        from public.planner_vehicles v
        where v.id = vehicle_id
          and v.user_id = auth.uid()
      )
    )
    and (
      transfer_to_vehicle_id is null
      or exists (
        select 1
        from public.planner_vehicles v
        where v.id = transfer_to_vehicle_id
          and v.user_id = auth.uid()
      )
    )
  );

drop policy if exists "transactions_update_own" on public.transactions;
create policy "transactions_update_own"
  on public.transactions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      vehicle_id is null
      or exists (
        select 1
        from public.planner_vehicles v
        where v.id = vehicle_id
          and v.user_id = auth.uid()
      )
    )
    and (
      transfer_to_vehicle_id is null
      or exists (
        select 1
        from public.planner_vehicles v
        where v.id = transfer_to_vehicle_id
          and v.user_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Wipe restore: round-trip transfer_to_vehicle_id
-- ---------------------------------------------------------------------------
create or replace function public._account_restore_from_payload(
  p_user uuid,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version int;
  r jsonb;
  v_currency text;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Invalid backup payload';
  end if;

  v_version := coalesce((p_payload ->> 'version')::int, 0);
  if v_version not in (1, 2) then
    raise exception 'Unsupported backup version';
  end if;

  if v_version >= 2 then
    v_currency := nullif(trim(coalesce(p_payload ->> 'currency', '')), '');
    if v_currency is not null then
      update public.profiles
      set currency = v_currency
      where id = p_user
        and v_currency in (
          'HKD', 'USD', 'CNY', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'SGD', 'CHF',
          'INR', 'KRW', 'TWD', 'THB', 'MYR', 'PHP', 'IDR', 'NZD', 'SEK', 'NOK'
        );
    end if;

    for r in
      select value
      from jsonb_array_elements(coalesce(p_payload -> 'user_categories', '[]'::jsonb))
    loop
      insert into public.user_categories (
        id, user_id, type, name, archived_at, created_at, updated_at
      )
      values (
        (r ->> 'id')::uuid,
        p_user,
        r ->> 'type',
        r ->> 'name',
        nullif(r ->> 'archived_at', '')::timestamptz,
        coalesce((r ->> 'created_at')::timestamptz, now()),
        coalesce((r ->> 'updated_at')::timestamptz, now())
      );
    end loop;
  end if;

  alter table public.planner_contribution_events
    disable trigger planner_contribution_events_apply_delta;

  begin
    for r in
      select value
      from jsonb_array_elements(coalesce(p_payload -> 'recurring_series', '[]'::jsonb))
    loop
      insert into public.recurring_series (
        id, user_id, amount, type, category, note, cadence, anchor_at, timezone,
        active, deleted_at, created_at, updated_at, byweekday, ends_on, ends_after_count
      )
      values (
        (r ->> 'id')::uuid,
        p_user,
        (r ->> 'amount')::numeric,
        r ->> 'type',
        r ->> 'category',
        r ->> 'note',
        r ->> 'cadence',
        (r ->> 'anchor_at')::timestamptz,
        coalesce(nullif(r ->> 'timezone', ''), 'UTC'),
        coalesce((r ->> 'active')::boolean, true),
        nullif(r ->> 'deleted_at', '')::timestamptz,
        coalesce((r ->> 'created_at')::timestamptz, now()),
        coalesce((r ->> 'updated_at')::timestamptz, now()),
        case
          when r -> 'byweekday' is null or jsonb_typeof(r -> 'byweekday') = 'null'
            then null
          else (
            select array_agg(x::smallint)
            from jsonb_array_elements_text(r -> 'byweekday') as x
          )
        end,
        nullif(r ->> 'ends_on', '')::date,
        nullif(r ->> 'ends_after_count', '')::integer
      );
    end loop;

    -- Vehicles before transactions so vehicle_id / transfer_to FKs resolve.
    for r in
      select value
      from jsonb_array_elements(coalesce(p_payload -> 'planner_vehicles', '[]'::jsonb))
    loop
      insert into public.planner_vehicles (
        id, user_id, name, vehicle_type, balance, annual_rate, growth_mode,
        plan_amount, plan_cadence, notes, deleted_at, created_at, updated_at,
        compound_period, is_default
      )
      values (
        (r ->> 'id')::uuid,
        p_user,
        r ->> 'name',
        r ->> 'vehicle_type',
        coalesce((r ->> 'balance')::numeric, 0),
        coalesce((r ->> 'annual_rate')::numeric, 0),
        r ->> 'growth_mode',
        nullif(r ->> 'plan_amount', '')::numeric,
        nullif(r ->> 'plan_cadence', ''),
        r ->> 'notes',
        nullif(r ->> 'deleted_at', '')::timestamptz,
        coalesce((r ->> 'created_at')::timestamptz, now()),
        coalesce((r ->> 'updated_at')::timestamptz, now()),
        coalesce(nullif(r ->> 'compound_period', ''), 'yearly'),
        coalesce((r ->> 'is_default')::boolean, false)
      );
    end loop;

    for r in
      select value
      from jsonb_array_elements(coalesce(p_payload -> 'transactions', '[]'::jsonb))
    loop
      insert into public.transactions (
        id, user_id, amount, type, category, note, currency, occurred_at,
        deleted_at, created_at, updated_at, recurring_series_id, occurrence_key,
        vehicle_id, transfer_to_vehicle_id
      )
      values (
        (r ->> 'id')::uuid,
        p_user,
        (r ->> 'amount')::numeric,
        r ->> 'type',
        r ->> 'category',
        r ->> 'note',
        coalesce(
          nullif(r ->> 'currency', ''),
          (select currency from public.profiles where id = p_user),
          'HKD'
        ),
        (r ->> 'occurred_at')::timestamptz,
        nullif(r ->> 'deleted_at', '')::timestamptz,
        coalesce((r ->> 'created_at')::timestamptz, now()),
        coalesce((r ->> 'updated_at')::timestamptz, now()),
        nullif(r ->> 'recurring_series_id', '')::uuid,
        nullif(r ->> 'occurrence_key', ''),
        nullif(r ->> 'vehicle_id', '')::uuid,
        nullif(r ->> 'transfer_to_vehicle_id', '')::uuid
      );
    end loop;

    for r in
      select value
      from jsonb_array_elements(coalesce(p_payload -> 'planner_goals', '[]'::jsonb))
    loop
      insert into public.planner_goals (
        id, user_id, name, goal_type, target_amount, target_date, current_saved,
        plan_amount, plan_cadence, notes, deleted_at, created_at, updated_at
      )
      values (
        (r ->> 'id')::uuid,
        p_user,
        r ->> 'name',
        r ->> 'goal_type',
        (r ->> 'target_amount')::numeric,
        nullif(r ->> 'target_date', '')::date,
        coalesce((r ->> 'current_saved')::numeric, 0),
        nullif(r ->> 'plan_amount', '')::numeric,
        nullif(r ->> 'plan_cadence', ''),
        r ->> 'notes',
        nullif(r ->> 'deleted_at', '')::timestamptz,
        coalesce((r ->> 'created_at')::timestamptz, now()),
        coalesce((r ->> 'updated_at')::timestamptz, now())
      );
    end loop;

    for r in
      select value
      from jsonb_array_elements(coalesce(p_payload -> 'planner_goal_vehicles', '[]'::jsonb))
    loop
      insert into public.planner_goal_vehicles (
        goal_id, vehicle_id, user_id, created_at
      )
      values (
        (r ->> 'goal_id')::uuid,
        (r ->> 'vehicle_id')::uuid,
        p_user,
        coalesce((r ->> 'created_at')::timestamptz, now())
      );
    end loop;

    for r in
      select value
      from jsonb_array_elements(
        coalesce(p_payload -> 'planner_contribution_events', '[]'::jsonb)
      )
    loop
      insert into public.planner_contribution_events (
        id, user_id, goal_id, amount, contributed_at, note, created_at, updated_at
      )
      values (
        (r ->> 'id')::uuid,
        p_user,
        (r ->> 'goal_id')::uuid,
        (r ->> 'amount')::numeric,
        (r ->> 'contributed_at')::date,
        r ->> 'note',
        coalesce((r ->> 'created_at')::timestamptz, now()),
        coalesce((r ->> 'updated_at')::timestamptz, now())
      );
    end loop;
  exception
    when others then
      alter table public.planner_contribution_events
        enable trigger planner_contribution_events_apply_delta;
      raise;
  end;

  alter table public.planner_contribution_events
    enable trigger planner_contribution_events_apply_delta;

  for r in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'planner_goals', '[]'::jsonb))
  loop
    update public.planner_goals
    set current_saved = coalesce((r ->> 'current_saved')::numeric, 0)
    where id = (r ->> 'id')::uuid
      and user_id = p_user;
  end loop;
end;
$$;
