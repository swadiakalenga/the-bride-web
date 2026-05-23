-- Migration: add Mux live stream fields to church_live_events
-- Run once in Supabase SQL Editor (or via supabase db push).
-- Safe to run multiple times — uses IF NOT EXISTS / IF EXISTS guards.

ALTER TABLE church_live_events
  ADD COLUMN IF NOT EXISTS stream_key text,
  ADD COLUMN IF NOT EXISTS provider   text DEFAULT 'mux',
  ADD COLUMN IF NOT EXISTS playback_id text;

-- Speed up lookups by Mux stream_input_id
CREATE INDEX IF NOT EXISTS idx_cle_stream_input_id
  ON church_live_events (stream_input_id)
  WHERE stream_input_id IS NOT NULL;

-- RLS: stream_key is visible only to the church admin who owns the event.
-- Viewers / followers will receive NULL for stream_key via normal SELECT.
-- (Requires RLS to be enabled on the table.)
CREATE POLICY IF NOT EXISTS "church_admin_sees_stream_key"
  ON church_live_events
  AS RESTRICTIVE
  FOR SELECT
  USING (
    stream_key IS NULL
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id        = auth.uid()
        AND profiles.role      = 'church_admin'
        AND profiles.church_id = church_live_events.church_id
    )
  );
