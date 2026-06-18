-- Stripe billing columns on profiles
alter table public.profiles
  add column if not exists plan text not null default 'free',           -- 'free' | 'starter' | 'pro'
  add column if not exists review_credits integer not null default 0,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text;                     -- 'active' | 'canceled' | 'past_due'

-- Index for webhook lookups by subscription id
create index if not exists idx_profiles_stripe_sub
  on public.profiles(stripe_subscription_id)
  where stripe_subscription_id is not null;

-- Atomic credit increment used by webhook (avoids read-modify-write race)
create or replace function public.increment_review_credits(user_id uuid, amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set review_credits = review_credits + amount
  where id = user_id;
end;
$$;

revoke execute on function public.increment_review_credits(uuid, integer) from public, anon;
grant execute on function public.increment_review_credits(uuid, integer) to service_role;
