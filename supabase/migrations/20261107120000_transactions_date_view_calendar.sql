-- Transactions date view: drop Week; rename Month → Calendar.
-- Legacy week|month rows migrate to calendar. Default calendar.
-- Founder: npx supabase db push

update public.profiles
set transactions_date_view = 'calendar'
where transactions_date_view in ('week', 'month');

alter table public.profiles
  alter column transactions_date_view set default 'calendar';

alter table public.profiles
  drop constraint if exists profiles_transactions_date_view_check;

alter table public.profiles
  add constraint profiles_transactions_date_view_check
  check (transactions_date_view in ('list', 'calendar'));

comment on column public.profiles.transactions_date_view is
  'Transactions screen date layout: list (by day) or calendar (month grid). Default calendar.';
