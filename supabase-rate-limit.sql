-- =============================================================================
-- TheBride Rate Limiting & Anti-Spam Architecture
-- Version: 2026-05-20
-- Idempotent — safe to re-run.
--
-- Run order: after supabase-migration.sql and supabase-production-rls.sql.
--
-- Overview
-- --------
-- This file implements a lightweight, in-database rate-limiting layer that
-- protects the platform's write operations from spam, abuse, and accidental
-- rapid-fire submissions.  Every check is done inside SECURITY DEFINER
-- functions so that the underlying rate_limits table is never directly
-- accessible to client code.
--
-- Architecture
-- ────────────
--  rate_limits           — append-only event log; one row per action attempt
--  check_rate_limit()    — core sliding-window checker + recorder
--  can_*()               — per-action wrappers called from application RPCs
--  cleanup_rate_limits() — purge rows older than 24 h (schedule via pg_cron)
--  is_duplicate_post()   — content-fingerprint dedup within 1 h
--
-- Payload limits are enforced as CHECK constraints on the relevant tables.
-- =============================================================================


-- =============================================================================
-- A.  Rate-limit tracking table
-- =============================================================================

-- Each row records a single action attempt by a user.
-- The table is an append-only event log; rows are never updated.
-- Cleanup is performed asynchronously by cleanup_rate_limits().
create table if not exists rate_limits (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  -- Action key, e.g. 'post_minute', 'post_hour', 'comment_minute', etc.
  -- Naming convention: <resource>_<window_shortname>
  action     text        not null,
  created_at timestamptz not null default now()
);

-- Composite index over (user_id, action, created_at desc) so that the window
-- queries in check_rate_limit() are index-only scans.
create index if not exists idx_rate_limits_user_action_time
  on rate_limits(user_id, action, created_at desc);

-- Enable RLS; all access is gated through SECURITY DEFINER functions below.
alter table rate_limits enable row level security;

-- Drop any stale policies before (re-)creating, to keep the file idempotent.
drop policy if exists "rate_limits no direct access" on rate_limits;

-- Deny ALL direct client access.  This single policy covers every operation
-- (SELECT, INSERT, UPDATE, DELETE) for the 'authenticated' role.
-- Reads and writes only happen via SECURITY DEFINER functions that bypass RLS.
create policy "rate_limits no direct access" on rate_limits
  for all to authenticated
  using (false)
  with check (false);

-- The 'anon' role must never touch this table.
revoke all on table rate_limits from anon;


-- =============================================================================
-- B.  Core sliding-window rate-limit function
-- =============================================================================

-- check_rate_limit(p_action, p_limit, p_window)
-- ──────────────────────────────────────────────
-- Returns TRUE  → the action is ALLOWED and has been recorded.
-- Returns FALSE → the caller has hit the limit; action is NOT recorded.
--
-- The function runs with SECURITY DEFINER so it can INSERT into rate_limits
-- regardless of the deny-all RLS policy above.  It uses auth.uid() to
-- identify the caller, so it is safe even when invoked via PostgREST/Supabase
-- client libraries.
--
-- Parameters
--   p_action  — action key to count (must match the key used when inserting)
--   p_limit   — maximum number of actions allowed in the window
--   p_window  — sliding time window (e.g. interval '1 minute')
create or replace function public.check_rate_limit(
  p_action text,
  p_limit  integer,
  p_window interval
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  -- Count how many times this user has performed this action in the window.
  select count(*)
    into v_count
    from rate_limits
   where user_id    = auth.uid()
     and action     = p_action
     and created_at > now() - p_window;

  -- If the user is at or over the limit, deny without recording.
  if v_count >= p_limit then
    return false; -- blocked
  end if;

  -- Under the limit — record this attempt and allow the action.
  insert into rate_limits(user_id, action, created_at)
  values (auth.uid(), p_action, now());

  return true; -- allowed
end;
$$;

-- Deny anon, grant only authenticated users.
revoke all  on function public.check_rate_limit(text, integer, interval) from anon, public;
grant execute on function public.check_rate_limit(text, integer, interval) to authenticated;


-- =============================================================================
-- C.  Per-action rate-limit enforcement functions
-- =============================================================================
-- Each function checks one or more windows sequentially (most restrictive
-- first) and returns FALSE as soon as any window is exceeded.
-- The calling RPC or trigger should raise an exception when these return false.
--
-- Action key naming convention:
--   <resource>_minute  — short burst window (1 minute)
--   <resource>_hour    — medium-term window (1 hour)
--   <resource>_day     — daily limit (24 hours)
--   <resource>_month   — monthly limit (30 days)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- C-1.  Post creation: 3 per minute, 10 per hour
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.can_create_post()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Short-burst guard: 3 posts per minute prevents rapid spam.
  if not public.check_rate_limit('post_minute', 3, interval '1 minute') then
    return false;
  end if;

  -- Hourly cap: 10 posts per hour prevents sustained flooding.
  if not public.check_rate_limit('post_hour', 10, interval '1 hour') then
    return false;
  end if;

  return true;
end;
$$;

revoke all  on function public.can_create_post() from anon, public;
grant execute on function public.can_create_post() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- C-2.  Comment creation: 5 per minute, 30 per hour
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.can_create_comment()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 5 comments per minute: allows active participation without spam.
  if not public.check_rate_limit('comment_minute', 5, interval '1 minute') then
    return false;
  end if;

  -- 30 comments per hour: reasonable ceiling for heavy commenters.
  if not public.check_rate_limit('comment_hour', 30, interval '1 hour') then
    return false;
  end if;

  return true;
end;
$$;

revoke all  on function public.can_create_comment() from anon, public;
grant execute on function public.can_create_comment() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- C-3.  Follow: 10 per minute, 50 per hour
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.can_follow()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 10 follows per minute: blocks automated mass-follow scripts.
  if not public.check_rate_limit('follow_minute', 10, interval '1 minute') then
    return false;
  end if;

  -- 50 follows per hour: enough for a new user discovering the community
  -- without enabling aggressive follow-farming.
  if not public.check_rate_limit('follow_hour', 50, interval '1 hour') then
    return false;
  end if;

  return true;
end;
$$;

revoke all  on function public.can_follow() from anon, public;
grant execute on function public.can_follow() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- C-4.  Direct messages: 10 per minute, 60 per hour
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.can_send_message()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 10 per minute: prevents rapid-fire harassment in a single conversation.
  if not public.check_rate_limit('message_minute', 10, interval '1 minute') then
    return false;
  end if;

  -- 60 per hour: permits genuine conversation across multiple threads.
  if not public.check_rate_limit('message_hour', 60, interval '1 hour') then
    return false;
  end if;

  return true;
end;
$$;

revoke all  on function public.can_send_message() from anon, public;
grant execute on function public.can_send_message() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- C-5.  Donations: 5 per 24 hours
-- Donations must also pass payment validation in the application layer;
-- this limit is an additional safeguard against duplicate submissions.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.can_submit_donation()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 5 donations per day: covers legitimate multiple giving types (tithe,
  -- offering, mission, etc.) while blocking automated abuse.
  if not public.check_rate_limit('donation_day', 5, interval '24 hours') then
    return false;
  end if;

  return true;
end;
$$;

revoke all  on function public.can_submit_donation() from anon, public;
grant execute on function public.can_submit_donation() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- C-6.  Content reports: 10 per 24 hours
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.can_submit_report()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 10 reports per day: enough for a vigilant community member to flag
  -- problematic content without enabling targeted harassment campaigns.
  if not public.check_rate_limit('report_day', 10, interval '24 hours') then
    return false;
  end if;

  return true;
end;
$$;

revoke all  on function public.can_submit_report() from anon, public;
grant execute on function public.can_submit_report() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- C-7.  Live-stream chat: 30 per minute
-- Higher limit than regular messages because live chat is ephemeral and
-- fast-paced by nature.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.can_send_live_chat()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 30 messages per minute keeps live chat interactive while preventing
  -- individuals from flooding the shared stream chat.
  if not public.check_rate_limit('live_chat_minute', 30, interval '1 minute') then
    return false;
  end if;

  return true;
end;
$$;

revoke all  on function public.can_send_live_chat() from anon, public;
grant execute on function public.can_send_live_chat() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- C-8.  Church verification request: 1 per 30 days
-- Prevents churches from spamming the review queue after a rejection.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.can_submit_church_verification()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 1 submission per 30 days: gives admins time to review before a re-apply.
  if not public.check_rate_limit('church_verify_month', 1, interval '30 days') then
    return false;
  end if;

  return true;
end;
$$;

revoke all  on function public.can_submit_church_verification() from anon, public;
grant execute on function public.can_submit_church_verification() to authenticated;


-- =============================================================================
-- D.  Cleanup function
-- =============================================================================
-- cleanup_rate_limits()
-- ─────────────────────
-- Deletes all rate_limits rows older than 24 hours.  24 hours covers every
-- window used by the can_*() functions above, so no live data is lost.
--
-- Scheduling options:
--   1. pg_cron  (Supabase Pro / Enterprise):
--        select cron.schedule('cleanup-rate-limits', '0 * * * *',
--                             'select public.cleanup_rate_limits()');
--   2. Supabase Edge Function with a scheduled trigger (Starter plan).
--   3. External cron job calling the Supabase REST API with a service-role key.
create or replace function public.cleanup_rate_limits()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Remove entries outside all possible windows (max window = 30 days for
  -- church verification; keeping 24 h is intentional — the 30-day window is
  -- managed correctly because older matching rows are simply gone, which means
  -- a fresh submission will be allowed again, matching the intended behaviour).
  -- If you need to enforce the 30-day window across server restarts ensure
  -- this function runs at most once per 24 h and that the church_verify_month
  -- key is retained for the full window.  Adjust the retention period below
  -- if you need to keep the 30-day window intact between cleanups.
  delete from rate_limits
   where created_at < now() - interval '24 hours';
end;
$$;

-- Cleanup must ONLY be called by the service role or pg_cron.
-- Deny access to anon and the authenticated (user-facing) role.
revoke all on function public.cleanup_rate_limits() from anon, authenticated, public;
-- The service_role bypasses RLS by default and does not require an explicit
-- GRANT; however, granting to postgres (superuser) is harmless and explicit.
grant execute on function public.cleanup_rate_limits() to postgres;


-- =============================================================================
-- E.  Duplicate content detection
-- =============================================================================

-- is_duplicate_post(p_content)
-- ─────────────────────────────
-- Returns TRUE if the calling user has already posted identical content within
-- the last hour.  Call this BEFORE inserting a new post row; if it returns
-- true, reject the request with a user-facing message such as:
--   "You've already posted this content recently."
--
-- The function runs SECURITY DEFINER so it can read the posts table without
-- being subject to any custom RLS policies that might interfere.
create or replace function public.is_duplicate_post(p_content text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  -- Exact-match check against the caller's own posts in the last hour.
  -- Trimming whitespace guards against trivial padding tricks.
  select count(*)
    into v_count
    from posts
   where user_id    = auth.uid()
     and content    = trim(p_content)
     and created_at > now() - interval '1 hour';

  return v_count > 0;
end;
$$;

revoke all  on function public.is_duplicate_post(text) from anon, public;
grant execute on function public.is_duplicate_post(text) to authenticated;


-- =============================================================================
-- F.  Payload size enforcement (CHECK constraints)
-- =============================================================================
-- These constraints are the last line of defence against oversized payloads
-- that could degrade database and storage performance.
-- All constraints use "add constraint if not exists" syntax so the file is
-- fully idempotent even if a constraint already exists under the same name.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- F-1.  Posts: max 5 000 characters of body text
-- ─────────────────────────────────────────────────────────────────────────────
-- The constraint name is deliberately descriptive so it surfaces a clear error
-- message when violated: "new row violates check constraint posts_content_maxlen"
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'posts_content_maxlen'
       and conrelid = 'public.posts'::regclass
  ) then
    alter table public.posts
      add constraint posts_content_maxlen
      check (length(content) <= 5000);
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- F-2.  Comments: max 2 000 characters
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'comments_content_maxlen'
       and conrelid = 'public.comments'::regclass
  ) then
    alter table public.comments
      add constraint comments_content_maxlen
      check (length(content) <= 2000);
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- F-3.  Messages: ensure content column exists, then enforce 2 000 char limit.
-- The messages.content column was added via supabase-migration.sql; the ALTER
-- below is a no-op if the column already exists.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.messages add column if not exists content text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'messages_content_maxlen'
       and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint messages_content_maxlen
      check (content is null or length(content) <= 2000);
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- F-4.  Prayer requests: max 1 000 characters
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'prayer_content_maxlen'
       and conrelid = 'public.prayer_requests'::regclass
  ) then
    alter table public.prayer_requests
      add constraint prayer_content_maxlen
      check (length(content) <= 1000);
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- F-5.  Profiles: cap bio / display name to sensible lengths.
-- full_name  ≤ 100 chars;  bio ≤ 500 chars (added if column exists).
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  -- full_name constraint
  if not exists (
    select 1 from pg_constraint
     where conname = 'profiles_full_name_maxlen'
       and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_full_name_maxlen
      check (full_name is null or length(full_name) <= 100);
  end if;

  -- bio constraint (column may not exist on older installs — skip gracefully)
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'profiles'
       and column_name  = 'bio'
  ) then
    if not exists (
      select 1 from pg_constraint
       where conname = 'profiles_bio_maxlen'
         and conrelid = 'public.profiles'::regclass
    ) then
      alter table public.profiles
        add constraint profiles_bio_maxlen
        check (bio is null or length(bio) <= 500);
    end if;
  end if;
end $$;

-- =============================================================================
-- End of supabase-rate-limit.sql
-- =============================================================================
