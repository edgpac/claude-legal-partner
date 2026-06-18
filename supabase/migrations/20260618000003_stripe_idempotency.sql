-- Idempotency table for Stripe webhook events.
-- Prevents double-processing on Stripe retries (timeout, network errors, etc.).
create table if not exists public.stripe_processed_events (
  event_id    text primary key,
  processed_at timestamptz not null default now()
);

-- Only the service role (edge function) needs access; no user-facing RLS policy required.
alter table public.stripe_processed_events enable row level security;

-- Auto-clean events older than 30 days to keep the table small.
-- Run via pg_cron or a scheduled Supabase function; not required for correctness.
create index if not exists idx_stripe_events_processed_at
  on public.stripe_processed_events(processed_at);
