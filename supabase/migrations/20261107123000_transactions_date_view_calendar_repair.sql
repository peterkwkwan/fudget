-- Idempotent repair for hosted DBs where 20261107120000 failed mid-run
-- (UPDATE to calendar while profiles_transactions_date_view_check still
-- only allowed list|week|month). Safe to re-run.
-- Founder: npx supabase db push — or paste the same statements in SQL Editor.

alter table public.profiles
  drop constraint if exists profiles_transactions_date_view_check;

update public.profiles
set transactions_date_view = 'calendar'
where transactions_date_view in ('week', 'month');

alter table public.profiles
  alter column transactions_date_view set default 'calendar';

alter table public.profiles
  add constraint profiles_transactions_date_view_check
  check (transactions_date_view in ('list', 'calendar'));

comment on column public.profiles.transactions_date_view is
  'Transactions screen date layout: list (by day) or calendar (month grid). Default calendar.';
