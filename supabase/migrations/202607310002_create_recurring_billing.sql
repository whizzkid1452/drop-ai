create table public.billing_authorization_intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_key text not null unique,
  amount_krw integer not null check (amount_krw > 0),
  expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index one_open_billing_intent_per_user
  on public.billing_authorization_intents (user_id)
  where completed_at is null;

create table public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  customer_key text not null unique,
  billing_key_ciphertext text not null,
  status text not null check (
    status in ('pending', 'active', 'cancel_at_period_end', 'past_due', 'canceled')
  ),
  amount_krw integer not null check (amount_krw > 0),
  charge_sequence integer not null default 0 check (charge_sequence >= 0),
  billing_anchor_day smallint not null check (billing_anchor_day between 1 and 31),
  current_period_start timestamptz,
  current_period_end timestamptz,
  next_charge_at timestamptz,
  processing_started_at timestamptz,
  card_issuer_code text,
  card_last_four text check (card_last_four is null or card_last_four ~ '^[0-9]{4}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.billing_orders (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.billing_subscriptions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  charge_sequence integer not null check (charge_sequence >= 0),
  provider_order_id text not null unique,
  idempotency_key text not null unique,
  amount_krw integer not null check (amount_krw > 0),
  status text not null check (status in ('processing', 'succeeded', 'failed')),
  payment_key text unique,
  provider_error_code text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subscription_id, charge_sequence)
);

alter table public.billing_authorization_intents enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_orders enable row level security;

-- 빌링키와 주문은 결제를 실행할 수 있는 서버 전용 정보이므로 브라우저 역할의 접근을 모두 차단한다.
revoke all on public.billing_authorization_intents from anon, authenticated;
revoke all on public.billing_subscriptions from anon, authenticated;
revoke all on public.billing_orders from anon, authenticated;
grant all on public.billing_authorization_intents to service_role;
grant all on public.billing_subscriptions to service_role;
grant all on public.billing_orders to service_role;

create or replace function public.create_billing_authorization_intent(
  p_user_id uuid,
  p_customer_key text,
  p_amount_krw integer,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from auth.users where id = p_user_id for update;

  if exists (
    select 1
    from public.billing_subscriptions
    where user_id = p_user_id
      and status in ('pending', 'active', 'cancel_at_period_end')
  ) then
    raise exception 'SUBSCRIPTION_ALREADY_ACTIVE';
  end if;

  delete from public.billing_authorization_intents
  where user_id = p_user_id and completed_at is null;

  insert into public.billing_authorization_intents (
    user_id,
    customer_key,
    amount_krw,
    expires_at
  )
  values (p_user_id, p_customer_key, p_amount_krw, p_expires_at);
end;
$$;

create or replace function public.complete_billing_authorization(
  p_user_id uuid,
  p_customer_key text,
  p_billing_key_ciphertext text,
  p_card_issuer_code text,
  p_card_last_four text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  authorization_intent public.billing_authorization_intents%rowtype;
  existing_status text;
begin
  select *
  into authorization_intent
  from public.billing_authorization_intents
  where user_id = p_user_id and customer_key = p_customer_key
  for update;

  if authorization_intent.id is null or authorization_intent.expires_at <= now() then
    raise exception 'INVALID_BILLING_INTENT';
  end if;
  if authorization_intent.completed_at is not null then
    return;
  end if;

  select status
  into existing_status
  from public.billing_subscriptions
  where user_id = p_user_id
  for update;

  if existing_status in ('pending', 'active', 'cancel_at_period_end') then
    raise exception 'SUBSCRIPTION_ALREADY_ACTIVE';
  end if;

  update public.billing_authorization_intents
  set completed_at = now()
  where id = authorization_intent.id;

  insert into public.billing_subscriptions (
    user_id,
    customer_key,
    billing_key_ciphertext,
    status,
    amount_krw,
    billing_anchor_day,
    next_charge_at,
    card_issuer_code,
    card_last_four
  )
  values (
    p_user_id,
    p_customer_key,
    p_billing_key_ciphertext,
    'pending',
    authorization_intent.amount_krw,
    extract(day from now())::smallint,
    now(),
    p_card_issuer_code,
    p_card_last_four
  )
  on conflict (user_id) do update
  set customer_key = excluded.customer_key,
      billing_key_ciphertext = excluded.billing_key_ciphertext,
      status = 'pending',
      amount_krw = excluded.amount_krw,
      charge_sequence = public.billing_subscriptions.charge_sequence + 1,
      billing_anchor_day = excluded.billing_anchor_day,
      current_period_start = null,
      current_period_end = null,
      next_charge_at = now(),
      processing_started_at = null,
      card_issuer_code = excluded.card_issuer_code,
      card_last_four = excluded.card_last_four,
      updated_at = now();
end;
$$;

create or replace function public.claim_due_billing_subscriptions(p_batch_size integer)
returns table (
  id uuid,
  user_id uuid,
  customer_key text,
  billing_key_ciphertext text,
  status text,
  amount_krw integer,
  charge_sequence integer,
  billing_anchor_day smallint,
  current_period_end timestamptz
)
language sql
security definer
set search_path = ''
as $$
  with candidates as (
    select subscription.id
    from public.billing_subscriptions as subscription
    where subscription.status in ('pending', 'active', 'cancel_at_period_end')
      and subscription.next_charge_at <= now()
      and (
        subscription.processing_started_at is null
        or subscription.processing_started_at < now() - interval '20 minutes'
      )
    order by subscription.next_charge_at
    for update skip locked
    limit greatest(1, least(p_batch_size, 50))
  )
  update public.billing_subscriptions as subscription
  set processing_started_at = now(),
      updated_at = now()
  from candidates
  where subscription.id = candidates.id
  returning
    subscription.id,
    subscription.user_id,
    subscription.customer_key,
    subscription.billing_key_ciphertext,
    subscription.status,
    subscription.amount_krw,
    subscription.charge_sequence,
    subscription.billing_anchor_day,
    subscription.current_period_end;
$$;

create or replace function public.complete_billing_charge(
  p_user_id uuid,
  p_charge_sequence integer,
  p_provider_order_id text,
  p_payment_key text,
  p_approved_at timestamptz,
  p_period_start timestamptz,
  p_period_end timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.billing_orders
  set status = 'succeeded',
      payment_key = p_payment_key,
      approved_at = p_approved_at,
      provider_error_code = null,
      updated_at = now()
  where user_id = p_user_id
    and charge_sequence = p_charge_sequence
    and provider_order_id = p_provider_order_id;

  if not found then
    raise exception 'BILLING_ORDER_NOT_FOUND';
  end if;

  update public.billing_subscriptions
  set status = 'active',
      current_period_start = p_period_start,
      current_period_end = p_period_end,
      next_charge_at = p_period_end,
      charge_sequence = charge_sequence + 1,
      processing_started_at = null,
      updated_at = now()
  where user_id = p_user_id and charge_sequence = p_charge_sequence;

  if not found then
    raise exception 'BILLING_SUBSCRIPTION_STATE_CONFLICT';
  end if;

  insert into public.account_entitlements (user_id, plan_code, status, current_period_end)
  values (p_user_id, 'pro', 'active', p_period_end)
  on conflict (user_id) do update
  set plan_code = 'pro',
      status = 'active',
      current_period_end = excluded.current_period_end,
      updated_at = now();
end;
$$;

create or replace function public.fail_billing_charge(
  p_user_id uuid,
  p_provider_order_id text,
  p_provider_error_code text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.billing_orders
  set status = 'failed',
      provider_error_code = p_provider_error_code,
      updated_at = now()
  where user_id = p_user_id and provider_order_id = p_provider_order_id;

  update public.billing_subscriptions
  set status = 'past_due',
      next_charge_at = null,
      processing_started_at = null,
      updated_at = now()
  where user_id = p_user_id;

  update public.account_entitlements
  set status = 'past_due',
      updated_at = now()
  where user_id = p_user_id and plan_code = 'pro';
end;
$$;

create or replace function public.schedule_billing_cancellation(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.billing_subscriptions
  set status = 'cancel_at_period_end',
      next_charge_at = case
        when status in ('pending', 'past_due') then now()
        else next_charge_at
      end,
      processing_started_at = null,
      updated_at = now()
  where user_id = p_user_id
    and status in ('pending', 'active', 'past_due');
  return found;
end;
$$;

create or replace function public.complete_billing_cancellation(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.billing_subscriptions
  set status = 'canceled',
      next_charge_at = null,
      processing_started_at = null,
      updated_at = now()
  where user_id = p_user_id and status = 'cancel_at_period_end';

  insert into public.account_entitlements (user_id, plan_code, status, current_period_end)
  values (p_user_id, 'free', 'active', null)
  on conflict (user_id) do update
  set plan_code = 'free',
      status = 'active',
      current_period_end = null,
      updated_at = now();
end;
$$;

revoke all on function public.complete_billing_authorization(uuid, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.create_billing_authorization_intent(uuid, text, integer, timestamptz)
  from public, anon, authenticated;
revoke all on function public.claim_due_billing_subscriptions(integer)
  from public, anon, authenticated;
revoke all on function public.complete_billing_charge(uuid, integer, text, text, timestamptz, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke all on function public.fail_billing_charge(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.schedule_billing_cancellation(uuid)
  from public, anon, authenticated;
revoke all on function public.complete_billing_cancellation(uuid)
  from public, anon, authenticated;

grant execute on function public.complete_billing_authorization(uuid, text, text, text, text)
  to service_role;
grant execute on function public.create_billing_authorization_intent(uuid, text, integer, timestamptz)
  to service_role;
grant execute on function public.claim_due_billing_subscriptions(integer)
  to service_role;
grant execute on function public.complete_billing_charge(uuid, integer, text, text, timestamptz, timestamptz, timestamptz)
  to service_role;
grant execute on function public.fail_billing_charge(uuid, text, text)
  to service_role;
grant execute on function public.schedule_billing_cancellation(uuid)
  to service_role;
grant execute on function public.complete_billing_cancellation(uuid)
  to service_role;
