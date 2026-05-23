-- ─────────────────────────────────────────────────────────────────────────────
-- supabase-fix-stale-live-events.sql
--
-- One-time cleanup: mark stuck live rows as ended.
--
-- A row is "stale live" if:
--   1. status = 'live' AND ended_at IS NOT NULL
--      (ended_at was set but the status column was never updated — data inconsistency)
--   2. status = 'live' AND started_at < now() - interval '6 hours'
--      (stream has been running for over 6 hours with no End Stream call)
--
-- Run this once in the Supabase SQL editor or via psql.
-- Safe to re-run — only affects rows that are still stuck as 'live'.
-- ─────────────────────────────────────────────────────────────────────────────

-- Case 1: ended_at is set but status was never updated
UPDATE public.church_live_events
SET
  status        = 'ended',
  ended_at      = COALESCE(ended_at, now()),
  replay_enabled = true
WHERE status = 'live'
  AND ended_at IS NOT NULL;

-- Case 2: still marked live but started more than 6 hours ago
UPDATE public.church_live_events
SET
  status        = 'ended',
  ended_at      = COALESCE(ended_at, now()),
  replay_enabled = true
WHERE status = 'live'
  AND started_at < now() - interval '6 hours';

-- Verification: confirm no stale rows remain
SELECT
  id,
  title,
  status,
  started_at,
  ended_at,
  replay_enabled
FROM public.church_live_events
WHERE status = 'live'
  AND (
    ended_at IS NOT NULL
    OR started_at < now() - interval '6 hours'
  );
-- Expected result: 0 rows returned.
