-- Read-receipt migration for TheBride messaging
-- Run this in Supabase SQL editor AFTER supabase-messaging-fix.sql.
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add read_at column to messages
--
--    NULL  = not yet read by the recipient
--    value = timestamp when the recipient first opened the conversation
--            (or when the real-time INSERT handler fired on their device)
-- ─────────────────────────────────────────────────────────────────────────────
alter table messages
  add column if not exists read_at timestamptz null;

-- Index speeds up "unread messages for a conversation" queries
create index if not exists messages_unread_idx
  on messages (conversation_id, read_at)
  where read_at is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS — participants may update read_at on messages they RECEIVED.
--
--    The existing "messages update participant" policy already allows any
--    participant to UPDATE any column.  We keep that broad policy but add a
--    tighter alternative below if you prefer.
--
--    If you want to lock it down so only the receiver can set read_at:
-- ─────────────────────────────────────────────────────────────────────────────
-- (optional — only needed if you replaced the broad update policy)
-- drop policy if exists "messages update read_at receiver" on messages;
-- create policy "messages update read_at receiver" on messages
--   for update to authenticated
--   using  (public.is_conversation_participant(conversation_id) and sender_id <> auth.uid())
--   with check (public.is_conversation_participant(conversation_id));
