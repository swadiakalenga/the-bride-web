-- ═══════════════════════════════════════════════════════════════════════════
-- TheBride — Notification type check constraint fix
-- Run once in Supabase SQL editor (idempotent — safe to re-run)
--
-- Root cause: review_church_verification() inserts type = 'church_verified'
-- or 'church_rejected', but the live constraint from supabase-migration.sql
-- only allows:
--   ('follow','like','comment','reply','membership_request','message',
--    'message_request','tag','prayer','event')
-- Neither church type is in that list → check constraint violation.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    -- Social
    'follow',
    'like',
    'comment',
    'reply',
    'tag',
    -- Messaging
    'message',
    'message_request',
    -- Church membership
    'membership_request',
    'membership_approved',
    'membership_rejected',
    -- Church verification (used by review_church_verification RPC)
    'church_verified',
    'church_rejected',
    -- Prayer & events
    'prayer',
    'event',
    -- Giving
    'donation_received',
    'tithe_received',
    'offering_received'
  ));

-- ── Done ──────────────────────────────────────────────────────────────────
-- After running:
-- 1. Open /admin/verifications as platform_admin
-- 2. Approve a pending verification → should succeed without constraint error
-- 3. Reject a pending verification → should succeed
-- 4. Verify the church_admin receives a notification in /notifications
