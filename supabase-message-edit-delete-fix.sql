-- ─────────────────────────────────────────────────────────────────────────────
-- supabase-message-edit-delete-fix.sql
--
-- Adds edit-tracking columns to the messages table and ensures the sender
-- can UPDATE and DELETE their own messages via RLS.
--
-- Safe to re-run — uses ADD COLUMN IF NOT EXISTS and existence checks for
-- policies so running twice is a no-op.
--
-- Run once in the Supabase SQL editor or via psql.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add edit-tracking columns
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_edited BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS edited_at  TIMESTAMPTZ;

-- 2. RLS: allow sender to UPDATE their own messages (edit content)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'messages'
      AND policyname = 'Sender can update own messages'
  ) THEN
    CREATE POLICY "Sender can update own messages"
      ON public.messages
      FOR UPDATE
      USING     (auth.uid() = sender_id)
      WITH CHECK (auth.uid() = sender_id);
  END IF;
END $$;

-- 3. RLS: allow sender to DELETE their own messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'messages'
      AND policyname = 'Sender can delete own messages'
  ) THEN
    CREATE POLICY "Sender can delete own messages"
      ON public.messages
      FOR DELETE
      USING (auth.uid() = sender_id);
  END IF;
END $$;

-- Verification: confirm columns exist
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'messages'
  AND column_name  IN ('is_edited', 'edited_at');
-- Expected: 2 rows returned (is_edited boolean default false, edited_at timestamptz)
