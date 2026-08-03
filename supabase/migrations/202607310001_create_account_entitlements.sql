create table if not exists public.account_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_code text not null default 'free' check (plan_code in ('free', 'pro')),
  status text not null default 'active' check (status in ('active', 'past_due')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.account_entitlements enable row level security;

revoke all on public.account_entitlements from anon, authenticated;
grant select (user_id, plan_code, status, current_period_end, created_at, updated_at)
  on public.account_entitlements to authenticated;
revoke insert, update, delete on public.account_entitlements from authenticated;

create policy "Users can read their own account entitlement"
  on public.account_entitlements
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.create_free_account_entitlement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.account_entitlements (user_id, plan_code, status)
  values (new.id, 'free', 'active')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_free_account_entitlement() from public, anon, authenticated;

drop trigger if exists create_free_account_entitlement_after_signup on auth.users;
create trigger create_free_account_entitlement_after_signup
  after insert on auth.users
  for each row execute function public.create_free_account_entitlement();

insert into public.account_entitlements (user_id, plan_code, status)
select id, 'free', 'active'
from auth.users
on conflict (user_id) do nothing;
