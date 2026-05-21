-- ═══════════════════════════════════════════════════════════════════════════
-- TheBride — Church verification status sync
-- Run once in Supabase SQL editor (idempotent — safe to re-run)
--
-- Root cause: tithe page checked verification_status = 'approved' but the
-- enum only contains 'verified'. Also, location_verified and
-- location_verification_status on churches were never populated by the
-- approval flow (trigger only updated verification_status).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Add location_verified_at column if it doesn't exist yet ────────────
ALTER TABLE public.churches
  ADD COLUMN IF NOT EXISTS location_verified_at timestamptz;

-- ── 2. Update the review function (re-run to apply the new churches update) ─
-- The updated function is in supabase-church-verification.sql.
-- Run that file first (or run the CREATE OR REPLACE block manually).
-- This migration handles backfilling existing rows.

-- ── 3. Sync churches where verification_status = 'verified' ──────────────
-- These were approved before location_verified / location_verification_status
-- were populated. Backfill so the canonical check passes all three fields.
UPDATE public.churches
SET
  location_verified            = true,
  location_verified_at         = COALESCE(location_verified_at, now()),
  location_verification_status = 'approved'
WHERE
  verification_status = 'verified'
  AND (
    location_verified IS DISTINCT FROM true
    OR location_verification_status IS DISTINCT FROM 'approved'
  );

-- ── 4. Sync churches where church_verifications.status = 'verified' ───────
-- In case the trigger fired but churches.verification_status was somehow
-- left on a different value, or the trigger hadn't been installed yet.
UPDATE public.churches c
SET
  verification_status          = 'verified',
  location_verified            = true,
  location_verified_at         = COALESCE(c.location_verified_at, now()),
  location_verification_status = 'approved'
FROM public.church_verifications cv
WHERE
  cv.church_id = c.id
  AND cv.status = 'verified'
  AND (
    c.verification_status IS DISTINCT FROM 'verified'
    OR c.location_verified IS DISTINCT FROM true
    OR c.location_verification_status IS DISTINCT FROM 'approved'
  );

-- ── 5. Sync churches where location_verification_status = 'approved' ──────
-- Reverse direction: if location was approved through another path, ensure
-- verification_status reflects that.
UPDATE public.churches
SET
  verification_status  = 'verified',
  location_verified    = true,
  location_verified_at = COALESCE(location_verified_at, now())
WHERE
  location_verification_status = 'approved'
  AND verification_status IS DISTINCT FROM 'verified';

-- ── 6. Sync rejections ────────────────────────────────────────────────────
UPDATE public.churches c
SET
  verification_status          = 'rejected',
  location_verified            = false,
  location_verification_status = 'rejected'
FROM public.church_verifications cv
WHERE
  cv.church_id = c.id
  AND cv.status = 'rejected'
  AND (
    c.verification_status IS DISTINCT FROM 'rejected'
    OR c.location_verified IS DISTINCT FROM false
    OR c.location_verification_status IS DISTINCT FROM 'rejected'
  );

-- ── Done ──────────────────────────────────────────────────────────────────
-- After running:
-- 1. ALSO run supabase-church-verification.sql to deploy the updated
--    review_church_verification() function (adds the churches UPDATE block)
-- 2. Open /church/[id]/tithe for a verified church — should show the give form
-- 3. Approve a new verification in /admin/verifications — should set all
--    three fields on churches immediately
-- 4. Re-run this script anytime to catch any remaining sync gaps (idempotent)
