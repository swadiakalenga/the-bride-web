-- ═══════════════════════════════════════════════════════════════════════════
-- TheBride — Church public read fix
-- Run once in Supabase SQL editor (idempotent — safe to re-run)
--
-- Fixes: /church/[id] shows "Church not found" for authenticated users even
-- though the church appears correctly in search results.
--
-- Root causes addressed:
-- 1. Missing address/payout columns: the church profile page selects
--    physical_address, address_line2, state_region, postal_code, public_address
--    — if these columns don't exist, Supabase returns an error and the page
--    silently renders "Church not found".
-- 2. RLS gap: if supabase-church-account-fixes.sql was run but the broad
--    "churches select authenticated" (USING true) policy was not active,
--    only platform_admin could read individual church rows.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Add missing columns (safe — skipped if columns already exist) ───────

ALTER TABLE public.churches
  ADD COLUMN IF NOT EXISTS physical_address            text,
  ADD COLUMN IF NOT EXISTS address_line2               text,
  ADD COLUMN IF NOT EXISTS state_region                text,
  ADD COLUMN IF NOT EXISTS postal_code                 text,
  ADD COLUMN IF NOT EXISTS public_address              boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS location_verified           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS location_verification_status text DEFAULT 'not_submitted',
  ADD COLUMN IF NOT EXISTS payout_contact_name         text,
  ADD COLUMN IF NOT EXISTS payout_contact_email        text,
  ADD COLUMN IF NOT EXISTS payout_country              text,
  ADD COLUMN IF NOT EXISTS preferred_payout_method     text,
  ADD COLUMN IF NOT EXISTS payout_bank_name            text,
  ADD COLUMN IF NOT EXISTS payout_account_holder       text,
  ADD COLUMN IF NOT EXISTS payout_last4                text,
  ADD COLUMN IF NOT EXISTS payout_status               text DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS stripe_account_id           text,
  ADD COLUMN IF NOT EXISTS stripe_onboarding_complete  boolean DEFAULT false;

-- ── 2. Broad authenticated SELECT policy — all logged-in users can read ────
-- This covers: regular users, church_admin, platform_admin.
-- The platform_admin_read_churches policy added in church-account-fixes.sql
-- is additive (OR logic) — this policy ensures regular users are NOT blocked.

DROP POLICY IF EXISTS "churches select authenticated"     ON public.churches;
DROP POLICY IF EXISTS "churches_select_authenticated"    ON public.churches;

CREATE POLICY "churches_select_authenticated"
ON public.churches FOR SELECT
TO authenticated
USING (true);

-- ── 3. Optional: allow anon (unauthenticated) users to discover churches ───
-- Uncomment if you want /church/[id] to work without login (public pages).
-- The app currently requires login (redirects to /login if no session).

-- DROP POLICY IF EXISTS "churches_select_anon" ON public.churches;
-- CREATE POLICY "churches_select_anon"
-- ON public.churches FOR SELECT
-- TO anon
-- USING (true);

-- ── 4. Ensure church_verifications table has required columns ───────────────
-- (Added in supabase-church-address-payout.sql — also idempotent here)

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
-- 1. Hard-refresh /church/[id] — should no longer show "Church not found"
-- 2. If debug block still shows, read the "error:" line for the exact cause
-- 3. Remove the debug block from app/church/[id]/page.tsx once confirmed working
-- 4. Verify search → click church still routes correctly
