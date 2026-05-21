-- ═══════════════════════════════════════════════════════════════════════════
-- TheBride — Church public read fix (v2)
-- Run once in Supabase SQL editor (idempotent — safe to re-run)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Add ALL missing church columns ─────────────────────────────────────

ALTER TABLE public.churches
  ADD COLUMN IF NOT EXISTS avatar_url                   text,
  ADD COLUMN IF NOT EXISTS cover_url                    text,
  ADD COLUMN IF NOT EXISTS email                        text,
  ADD COLUMN IF NOT EXISTS phone                        text,
  ADD COLUMN IF NOT EXISTS website                      text,
  ADD COLUMN IF NOT EXISTS city                         text,
  ADD COLUMN IF NOT EXISTS country                      text,
  ADD COLUMN IF NOT EXISTS physical_address             text,
  ADD COLUMN IF NOT EXISTS address_line2                text,
  ADD COLUMN IF NOT EXISTS state_region                 text,
  ADD COLUMN IF NOT EXISTS postal_code                  text,
  ADD COLUMN IF NOT EXISTS public_address               boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS location_verified            boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS location_verification_status text    DEFAULT 'not_submitted',
  ADD COLUMN IF NOT EXISTS payout_contact_name          text,
  ADD COLUMN IF NOT EXISTS payout_contact_email         text,
  ADD COLUMN IF NOT EXISTS payout_country               text,
  ADD COLUMN IF NOT EXISTS preferred_payout_method      text,
  ADD COLUMN IF NOT EXISTS payout_bank_name             text,
  ADD COLUMN IF NOT EXISTS payout_account_holder        text,
  ADD COLUMN IF NOT EXISTS payout_last4                 text,
  ADD COLUMN IF NOT EXISTS payout_status                text    DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS stripe_account_id            text,
  ADD COLUMN IF NOT EXISTS stripe_onboarding_complete   boolean DEFAULT false;

-- ── 2. churches SELECT — all authenticated users can read any church ───────

DROP POLICY IF EXISTS "churches select authenticated"     ON public.churches;
DROP POLICY IF EXISTS "churches_select_authenticated"     ON public.churches;
DROP POLICY IF EXISTS "platform_admin_read_churches"      ON public.churches;

CREATE POLICY "churches_select_authenticated"
ON public.churches FOR SELECT
TO authenticated
USING (true);

-- ── 3. church_verifications — nuclear drop of every known policy ───────────
-- The live DB has accumulated 10+ policies from multiple SQL runs, some with
-- spaces, some with underscores. Drop every known name before recreating.

DROP POLICY IF EXISTS "church admin insert verification"           ON public.church_verifications;
DROP POLICY IF EXISTS "church admin select own verification"       ON public.church_verifications;
DROP POLICY IF EXISTS "church admin update own verification"       ON public.church_verifications;
DROP POLICY IF EXISTS "church_admin_insert_verification"           ON public.church_verifications;
DROP POLICY IF EXISTS "church_admin_select_verification"           ON public.church_verifications;
DROP POLICY IF EXISTS "church_admin_update_verification"           ON public.church_verifications;
DROP POLICY IF EXISTS "church_verifications insert admin no pending" ON public.church_verifications;
DROP POLICY IF EXISTS "church_verifications select admin"          ON public.church_verifications;
DROP POLICY IF EXISTS "church_verifications update platform admin" ON public.church_verifications;
DROP POLICY IF EXISTS "platform_admin_update_verification"         ON public.church_verifications;
DROP POLICY IF EXISTS "platform_admin_read_verifications"          ON public.church_verifications;
DROP POLICY IF EXISTS "platform_admin_select_verification"         ON public.church_verifications;

-- ── 4. church_verifications — 3 clean non-recursive policies ──────────────
-- All USING / WITH CHECK clauses reference only public.profiles.
-- No policy queries church_verifications inside itself.

-- Policy 1: church_admin — full access to their own church's verification
CREATE POLICY "verif_church_admin"
ON public.church_verifications
FOR ALL                              -- covers INSERT, SELECT, UPDATE, DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id        = auth.uid()
      AND role      = 'church_admin'
      AND church_id = church_verifications.church_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id        = auth.uid()
      AND role      = 'church_admin'
      AND church_id = church_verifications.church_id
  )
);

-- Policy 2: platform_admin — read all verifications
CREATE POLICY "verif_platform_admin_select"
ON public.church_verifications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id   = auth.uid()
      AND role = 'platform_admin'
  )
);

-- Policy 3: platform_admin — approve / reject (update status, rejection_reason)
CREATE POLICY "verif_platform_admin_update"
ON public.church_verifications
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id   = auth.uid()
      AND role = 'platform_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id   = auth.uid()
      AND role = 'platform_admin'
  )
);

-- ── 5. church_verifications — ensure required columns exist ───────────────

ALTER TABLE public.church_verifications
  ADD COLUMN IF NOT EXISTS submitted_by        uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS location_proof_url  text,
  ADD COLUMN IF NOT EXISTS location_proof_type text,
  ADD COLUMN IF NOT EXISTS location_notes      text,
  ADD COLUMN IF NOT EXISTS pastor_name         text,
  ADD COLUMN IF NOT EXISTS contact_email       text,
  ADD COLUMN IF NOT EXISTS contact_phone       text,
  ADD COLUMN IF NOT EXISTS address             text,
  ADD COLUMN IF NOT EXISTS rejection_reason    text;

-- ── Done ──────────────────────────────────────────────────────────────────
-- After running:
-- 1. Hard-refresh /church/[id] — debug block should show no error
-- 2. Submit a verification as church_admin — should succeed without RLS error
-- 3. Open /admin/verifications as platform_admin — all records should be visible
-- 4. Approve/reject a verification as platform_admin — should succeed
