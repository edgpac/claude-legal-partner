-- Section 3: Auth — revoke over-broad anon grant on reviews (RLS handles share_token reads).
-- The original migration granted SELECT to anon on all reviews; that's too broad.
REVOKE SELECT ON public.reviews FROM anon;

-- Re-grant only via a tighter policy: anon can read a review only if it has a share_token.
-- (The existing RLS policy "Anyone with share token can read review" already enforces this —
-- removing the table-level grant so RLS is the only gate.)

-- Section 5: Rate limiting — index to make per-user hourly count queries fast.
CREATE INDEX IF NOT EXISTS idx_reviews_user_created
  ON public.reviews(user_id, created_at DESC);

-- Section 6: Storage — ensure the documents bucket enforces RLS (private, no public reads).
-- The bucket itself must be created in the Supabase dashboard with "public" = false.
-- The existing storage policies in migration 3 already scope to the owner's folder.
-- This migration adds an explicit check: no UPDATE on storage objects (immutable uploads only).
-- Users upload once; overwrite is prevented so no accidental data leakage via replace.
DROP POLICY IF EXISTS "Users update own documents" ON storage.objects;

-- Section 10: Privacy — delete account cascades all user data (documents + reviews + profile).
-- The ON DELETE CASCADE on all tables already handles this. This function wraps the auth deletion
-- so users can trigger it from the UI via a server function.
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow a user to delete their own account.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  -- Cascade deletes all documents, reviews, and profile rows via FK ON DELETE CASCADE.
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- Revoke public execute; only authenticated users may call it.
REVOKE EXECUTE ON FUNCTION public.delete_own_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
