-- ═══════════════════════════════════════════════════════════════════════════
-- TheBride — Church address, location verification & payout columns
-- Run once in Supabase SQL editor (idempotent — safe to re-run)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── PHASE 1 — Physical address ──────────────────────────────────────────────
ALTER TABLE churches
  ADD COLUMN IF NOT EXISTS physical_address             text,
  ADD COLUMN IF NOT EXISTS address_line2                text,
  ADD COLUMN IF NOT EXISTS state_region                 text,
  ADD COLUMN IF NOT EXISTS postal_code                  text,
  ADD COLUMN IF NOT EXISTS public_address               boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS location_verified            boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS location_verified_at         timestamptz,
  ADD COLUMN IF NOT EXISTS location_verification_status text    DEFAULT 'not_submitted';

-- Constrain the verification status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'churches_location_verification_status_check'
  ) THEN
    ALTER TABLE churches ADD CONSTRAINT churches_location_verification_status_check
      CHECK (location_verification_status IN (
        'not_submitted', 'pending', 'approved', 'rejected'
      ));
  END IF;
END $$;

-- ── PHASE 2 — Location proof columns on church_verifications ────────────────
-- Keep old columns (pastor_name, registration_doc_url, etc.) intact — only ADD.
ALTER TABLE church_verifications
  ADD COLUMN IF NOT EXISTS location_proof_url  text,
  ADD COLUMN IF NOT EXISTS location_proof_type text,   -- e.g. utility_bill, lease, letter
  ADD COLUMN IF NOT EXISTS location_notes      text;

-- ── PHASE 3 — Payout / bank setup columns ──────────────────────────────────
ALTER TABLE churches
  ADD COLUMN IF NOT EXISTS payout_contact_name        text,
  ADD COLUMN IF NOT EXISTS payout_contact_email       text,
  ADD COLUMN IF NOT EXISTS payout_country             text,
  ADD COLUMN IF NOT EXISTS preferred_payout_method    text DEFAULT 'manual_review',
  ADD COLUMN IF NOT EXISTS payout_bank_name           text,
  ADD COLUMN IF NOT EXISTS payout_account_holder      text,
  ADD COLUMN IF NOT EXISTS payout_last4               text,  -- last 4 digits only — never full number
  ADD COLUMN IF NOT EXISTS payout_status              text DEFAULT 'not_started',
  -- Future Stripe Connect fields (ready for when needed)
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id          text,
  ADD COLUMN IF NOT EXISTS stripe_connect_onboarding_complete boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_charges_enabled     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_payouts_enabled     boolean DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'churches_preferred_payout_method_check'
  ) THEN
    ALTER TABLE churches ADD CONSTRAINT churches_preferred_payout_method_check
      CHECK (preferred_payout_method IN (
        'stripe_connect', 'bank_transfer_review', 'manual_review'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'churches_payout_status_check'
  ) THEN
    ALTER TABLE churches ADD CONSTRAINT churches_payout_status_check
      CHECK (payout_status IN (
        'not_started', 'pending_review', 'approved', 'rejected'
      ));
  END IF;
END $$;

-- ── PHASE 5 — Ensure user_blocks covers church profiles ────────────────────
-- user_blocks already stores blocker_id / blocked_id (profile UUIDs).
-- No schema change needed — church admins have a profile row like any user.
-- Optionally extend with a note:
COMMENT ON TABLE user_blocks IS
  'Blocks between any two profile rows (personal or church_admin). '
  'Blocking a church admin profile hides their content and blocks messaging.';

-- ── Storage bucket note ─────────────────────────────────────────────────────
-- Run in Supabase Dashboard → Storage:
--   Bucket name: church-documents
--   Public:      NO  (private)
--   Allowed MIME types: image/*, application/pdf
--   Max file size: 10 MB
--
-- Add RLS policy on objects:
--   INSERT: auth.uid() = (storage.foldername(name))[1]::uuid
--   SELECT (signed URL only): platform_admin role via service role

-- ── Done ────────────────────────────────────────────────────────────────────
-- After running this file, restart your Next.js dev server so TypeScript picks
-- up any generated types from Supabase CLI if you use it.
