-- ═══════════════════════════════════════════════════════════════════════════
-- TheBride — Universal push notification device tokens
-- Run once in Supabase SQL editor (idempotent — safe to re-run)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. device_push_tokens table ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.device_push_tokens (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token       text        NOT NULL,
  platform    text        NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  enabled     boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, token)
);

-- Index: look up all active tokens for a user (push delivery path)
CREATE INDEX IF NOT EXISTS device_push_tokens_user_id_idx
  ON public.device_push_tokens (user_id)
  WHERE enabled = true;

-- ── 2. updated_at auto-refresh ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_device_push_tokens_updated_at ON public.device_push_tokens;
CREATE TRIGGER trg_device_push_tokens_updated_at
  BEFORE UPDATE ON public.device_push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 3. RLS ────────────────────────────────────────────────────────────────
ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;

-- Users manage only their own tokens (register, update enabled flag, delete)
DROP POLICY IF EXISTS "push_tokens_own" ON public.device_push_tokens;
CREATE POLICY "push_tokens_own" ON public.device_push_tokens
  FOR ALL TO authenticated
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Platform admins can read all tokens (for debugging / bulk ops)
DROP POLICY IF EXISTS "push_tokens_admin_read" ON public.device_push_tokens;
CREATE POLICY "push_tokens_admin_read" ON public.device_push_tokens
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'platform_admin'
    )
  );

-- ── 4. Service-role bypass note ───────────────────────────────────────────
-- The send-push-notification Edge Function uses the SERVICE_ROLE key,
-- which bypasses RLS. No additional policy is needed for the push sender.

-- ── Done ──────────────────────────────────────────────────────────────────
-- After running:
-- 1. Deploy the Edge Function:
--    supabase functions deploy send-push-notification
-- 2. Add secrets:
--    supabase secrets set FIREBASE_PROJECT_ID=...
--    supabase secrets set FIREBASE_CLIENT_EMAIL=...
--    supabase secrets set FIREBASE_PRIVATE_KEY=...
-- 3. Install APK and verify token appears in device_push_tokens table
