-- Security patch — run in Supabase SQL Editor after APPLY_MIGRATIONS.sql
-- Addresses: CRIT-2, CRIT-3, MED-3, MED-4

-- ==========================================
-- CRIT-2: Atomic credit consume function
-- Replaces stale-read check + update with a single atomic operation.
-- Returns TRUE if a credit was consumed, FALSE if none available.
-- ==========================================

CREATE OR REPLACE FUNCTION public.consume_review_credit(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_rows integer;
BEGIN
  UPDATE public.profiles
    SET review_credits = review_credits - 1
    WHERE id = p_user_id AND review_credits > 0;
  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RETURN updated_rows > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_review_credit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_review_credit(uuid) TO authenticated;

-- ==========================================
-- CRIT-3: Lock down stripe_processed_events
-- RLS was enabled with no policies — service_role bypasses RLS anyway,
-- but we explicitly deny all other roles to prevent enumeration.
-- ==========================================

REVOKE ALL ON public.stripe_processed_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.stripe_processed_events TO service_role;

-- Deny all via policy (service_role bypasses this, which is correct)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'stripe_processed_events' AND policyname = 'deny_all'
  ) THEN
    CREATE POLICY "deny_all" ON public.stripe_processed_events USING (false);
  END IF;
END $$;

-- ==========================================
-- MED-3: Track total reviews created — free tier gate uses this instead of COUNT(*)
-- A trigger increments it on every INSERT into reviews, never decrements.
-- ==========================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS total_reviews_created INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_total_reviews()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
    SET total_reviews_created = total_reviews_created + 1
    WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_total_reviews() FROM PUBLIC, anon, authenticated;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_review_created'
  ) THEN
    CREATE TRIGGER on_review_created
      AFTER INSERT ON public.reviews
      FOR EACH ROW EXECUTE FUNCTION public.increment_total_reviews();
  END IF;
END $$;

-- Backfill existing rows
UPDATE public.profiles p
  SET total_reviews_created = (
    SELECT COUNT(*) FROM public.reviews r WHERE r.user_id = p.id
  );

-- ==========================================
-- MED-4: Restrict user-writable columns on profiles
-- Users must not be able to write billing/plan fields directly.
-- Drop the overly broad FOR ALL policy and replace with scoped ones.
-- ==========================================

-- Drop the old catch-all policy
DROP POLICY IF EXISTS "Users manage own profile" ON public.profiles;

-- SELECT: users can read their own profile
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- INSERT: handled only by the handle_new_user() trigger (service_role)
-- No direct INSERT from authenticated role needed.

-- UPDATE: users may only write non-billing fields (display name, org name)
CREATE POLICY "Users update own profile safe fields" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND plan = (SELECT plan FROM public.profiles WHERE id = auth.uid())
    AND review_credits = (SELECT review_credits FROM public.profiles WHERE id = auth.uid())
    AND total_reviews_created = (SELECT total_reviews_created FROM public.profiles WHERE id = auth.uid())
    AND stripe_customer_id IS NOT DISTINCT FROM (SELECT stripe_customer_id FROM public.profiles WHERE id = auth.uid())
    AND stripe_subscription_id IS NOT DISTINCT FROM (SELECT stripe_subscription_id FROM public.profiles WHERE id = auth.uid())
    AND subscription_status IS NOT DISTINCT FROM (SELECT subscription_status FROM public.profiles WHERE id = auth.uid())
  );
