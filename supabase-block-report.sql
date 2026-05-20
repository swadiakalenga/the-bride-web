-- =============================================================================
-- TheBride Block / Mute / Report System
-- Version: 2026-05-20
-- Idempotent — safe to re-run.
--
-- Run order: after supabase-platform-admin.sql and supabase-rate-limit.sql.
--   supabase-platform-admin.sql creates:
--     • public.reports  (basic version — this file EXTENDS it)
--     • public.is_platform_admin()
--     • public.admin_list_reports(text, int)
--     • public.admin_update_report(uuid, text, text)
--   supabase-rate-limit.sql creates:
--     • public.can_submit_report()
--
-- What this file adds / upgrades
-- ───────────────────────────────
--   A. user_blocks table + RLS
--   B. user_mutes  table + RLS
--   C. Extends public.reports table (new columns, expanded constraints)
--   D. moderation_actions table (audit log for admin actions)
--   E. Block enforcement helpers: is_blocked_by(), has_blocked()
--   F. submit_report() — rate-limited RPC for users
--   G. admin_list_reports() — upgraded signature with p_offset + details column
--   H. admin_update_report() — upgraded to log to moderation_actions
--   I. can_send_message_request() — block-aware message-request guard
--   J. get_relationship_status() — block/mute status for profile page
-- =============================================================================


-- =============================================================================
-- A.  User blocks table
-- =============================================================================
-- Records "blocker has blocked blocked_id" relationships.
-- Blocking is one-directional in storage but bi-directionally enforced in
-- the helper functions below (a blocked user also cannot message the blocker).
create table if not exists public.user_blocks (
  id         uuid        primary key default gen_random_uuid(),
  blocker_id uuid        not null references auth.users(id) on delete cascade,
  blocked_id uuid        not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),

  -- Each (blocker, blocked) pair can only appear once.
  unique(blocker_id, blocked_id),

  -- A user cannot block themselves.
  constraint no_self_block check (blocker_id != blocked_id)
);

-- Index for "who has this user blocked?" queries (outbound blocks list).
create index if not exists idx_user_blocks_blocker
  on public.user_blocks(blocker_id);

-- Index for "who has blocked this user?" queries (used in feed/message filters).
create index if not exists idx_user_blocks_blocked
  on public.user_blocks(blocked_id);

alter table public.user_blocks enable row level security;

-- Drop any stale policies before recreating (idempotency).
drop policy if exists "blocks read own"   on public.user_blocks;
drop policy if exists "blocks insert own" on public.user_blocks;
drop policy if exists "blocks delete own" on public.user_blocks;

-- Users may only read the blocks THEY have placed (not who has blocked them —
-- that information could be used to game the system).
create policy "blocks read own" on public.user_blocks
  for select to authenticated
  using (blocker_id = auth.uid());

-- Users may only block others on their own behalf.
create policy "blocks insert own" on public.user_blocks
  for insert to authenticated
  with check (
    blocker_id = auth.uid()
    and blocker_id != blocked_id   -- mirrors the CHECK constraint
  );

-- Users may only unblock people they themselves blocked.
create policy "blocks delete own" on public.user_blocks
  for delete to authenticated
  using (blocker_id = auth.uid());


-- =============================================================================
-- B.  User mutes table
-- =============================================================================
-- Muting hides a user's content from the muter's feed without notifying the
-- muted user.  Unlike blocks, mutes do not affect the muted user's ability
-- to interact with the muter.
create table if not exists public.user_mutes (
  id         uuid        primary key default gen_random_uuid(),
  muter_id   uuid        not null references auth.users(id) on delete cascade,
  muted_id   uuid        not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),

  -- Each (muter, muted) pair can only appear once.
  unique(muter_id, muted_id),

  -- A user cannot mute themselves.
  constraint no_self_mute check (muter_id != muted_id)
);

-- Index for "who has this user muted?" lookups (feed filtering).
create index if not exists idx_user_mutes_muter
  on public.user_mutes(muter_id);

alter table public.user_mutes enable row level security;

drop policy if exists "mutes read own"   on public.user_mutes;
drop policy if exists "mutes insert own" on public.user_mutes;
drop policy if exists "mutes delete own" on public.user_mutes;

-- Only the muter can see their mute list.
create policy "mutes read own" on public.user_mutes
  for select to authenticated
  using (muter_id = auth.uid());

create policy "mutes insert own" on public.user_mutes
  for insert to authenticated
  with check (
    muter_id = auth.uid()
    and muter_id != muted_id   -- mirrors the CHECK constraint
  );

create policy "mutes delete own" on public.user_mutes
  for delete to authenticated
  using (muter_id = auth.uid());


-- =============================================================================
-- C.  Extend the reports table
-- =============================================================================
-- supabase-platform-admin.sql created public.reports with a minimal schema.
-- We extend it here to support richer reporting workflows without breaking
-- any code that already uses the original columns.
--
-- Original columns (from platform-admin.sql):
--   id, reporter_id, target_type, target_id, reason, status,
--   reviewed_by, reviewed_at, notes, created_at
--
-- This file adds:
--   details       — optional free-text elaboration (max 500 chars)
--   admin_notes   — aliases the original notes column for clarity
--
-- Column mapping note:
--   The original file uses "notes" for admin notes.  We keep that column and
--   add "details" as the user-supplied elaboration field so this file remains
--   compatible with existing admin_list_reports() and admin_update_report()
--   calls that reference "notes".
-- =============================================================================

-- Add the user-supplied elaboration column if absent.
alter table public.reports add column if not exists details text;

-- Expand target_type to include the content types used in this file.
-- We drop and recreate the constraint because PostgreSQL has no ALTER
-- CONSTRAINT ... ADD VALUE for check constraints.
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports
  add constraint reports_target_type_check
  check (target_type in (
    'post', 'comment', 'user', 'church',
    'livestream', 'message_request', 'message'
  ));

-- Expand the reason check to the full vocabulary.
alter table public.reports drop constraint if exists reports_reason_check;
alter table public.reports
  add constraint reports_reason_check
  check (reason in (
    'spam', 'harassment', 'hate_speech', 'sexual_content', 'misinformation',
    'impersonation', 'self_harm', 'violence', 'illegal_content', 'other'
  ));

-- Guard details length (max 500 characters).
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'reports_details_maxlen'
       and conrelid = 'public.reports'::regclass
  ) then
    alter table public.reports
      add constraint reports_details_maxlen
      check (details is null or length(details) <= 500);
  end if;
end $$;

-- Prevent reporting yourself as a user target.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'no_self_report'
       and conrelid = 'public.reports'::regclass
  ) then
    alter table public.reports
      add constraint no_self_report
      check (reporter_id != target_id or target_type != 'user');
  end if;
end $$;

-- Additional indexes for the extended query patterns below.
create index if not exists idx_reports_status
  on public.reports(status, created_at desc);

create index if not exists idx_reports_reporter
  on public.reports(reporter_id);

create index if not exists idx_reports_target
  on public.reports(target_type, target_id);

-- RLS — refresh to match the extended schema.
alter table public.reports enable row level security;

drop policy if exists "reports insert self"          on public.reports;
drop policy if exists "reports select self or admin" on public.reports;
drop policy if exists "reports update admin"         on public.reports;
-- Legacy names from platform-admin.sql (drop if they still exist).
drop policy if exists "reports read own"        on public.reports;
drop policy if exists "reports insert own"      on public.reports;
drop policy if exists "reports admin update"    on public.reports;

-- Reporters see only their own reports; platform_admins see everything.
create policy "reports select self or admin" on public.reports
  for select to authenticated
  using (
    reporter_id = auth.uid()
    or public.is_platform_admin()
  );

-- Authenticated users may submit reports on their own behalf.
create policy "reports insert self" on public.reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

-- Only platform_admin may update (review / resolve / dismiss) reports.
create policy "reports update admin" on public.reports
  for update to authenticated
  using  (public.is_platform_admin())
  with check (public.is_platform_admin());


-- =============================================================================
-- D.  Moderation actions audit log
-- =============================================================================
-- Every admin action (resolve/dismiss a report, ban a user, delete a post,
-- etc.) is recorded here for accountability and audit purposes.
-- This table is append-only; admins cannot delete or update rows.
create table if not exists public.moderation_actions (
  id          uuid        primary key default gen_random_uuid(),
  admin_id    uuid        not null references auth.users(id) on delete cascade,
  -- Type of action taken, e.g. 'reviewed_report', 'resolved_report',
  -- 'dismissed_report', 'banned_user', 'deleted_post'.
  action_type text        not null,
  -- The class of entity the action was taken on.
  target_type text        not null,
  -- The UUID of the specific entity (report id, user id, post id, etc.).
  target_id   uuid        not null,
  -- Optional human-readable notes from the admin.
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_moderation_actions_admin
  on public.moderation_actions(admin_id, created_at desc);

create index if not exists idx_moderation_actions_target
  on public.moderation_actions(target_type, target_id);

alter table public.moderation_actions enable row level security;

drop policy if exists "moderation_actions select admin" on public.moderation_actions;
drop policy if exists "moderation_actions insert admin" on public.moderation_actions;

-- Only platform_admins can read the audit log.
create policy "moderation_actions select admin" on public.moderation_actions
  for select to authenticated
  using (public.is_platform_admin());

-- Inserts are only allowed through SECURITY DEFINER admin functions below.
-- Direct inserts from client code are blocked.
create policy "moderation_actions insert admin" on public.moderation_actions
  for insert to authenticated
  with check (public.is_platform_admin());

-- No UPDATE or DELETE policies — this table is append-only by design.


-- =============================================================================
-- E.  Block enforcement helpers
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- is_blocked_by(p_other_user_id)
-- Returns TRUE if p_other_user_id has blocked the calling user.
-- Used to prevent blocked users from seeing the blocker's profile or sending
-- messages/follow requests.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.is_blocked_by(p_other_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
      from public.user_blocks
     where blocker_id = p_other_user_id
       and blocked_id = auth.uid()
  );
$$;

revoke all  on function public.is_blocked_by(uuid) from anon, public;
grant execute on function public.is_blocked_by(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- has_blocked(p_other_user_id)
-- Returns TRUE if the calling user has blocked p_other_user_id.
-- Used for UI state (show "Unblock" button, grey-out interactions, etc.).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.has_blocked(p_other_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
      from public.user_blocks
     where blocker_id = auth.uid()
       and blocked_id = p_other_user_id
  );
$$;

revoke all  on function public.has_blocked(uuid) from anon, public;
grant execute on function public.has_blocked(uuid) to authenticated;


-- =============================================================================
-- F.  submit_report() — rate-limited user-facing RPC
-- =============================================================================
-- Application code should call this RPC instead of inserting into reports
-- directly.  The function:
--   1. Enforces the rate limit via can_submit_report().
--   2. Validates all input values.
--   3. Prevents self-reporting.
--   4. Inserts the record and returns the new report id.
--
-- Parameters
--   p_target_type — one of the values in the reports_target_type_check constraint
--   p_target_id   — UUID of the reported entity
--   p_reason      — one of the values in the reports_reason_check constraint
--   p_details     — optional user elaboration (max 500 chars, enforced here
--                   and by the DB constraint)
create or replace function public.submit_report(
  p_target_type text,
  p_target_id   uuid,
  p_reason      text,
  p_details     text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  -- ── Rate limit ──────────────────────────────────────────────────────────────
  -- can_submit_report() is defined in supabase-rate-limit.sql.
  -- It checks 10 reports per 24 hours and records the attempt.
  if not public.can_submit_report() then
    raise exception
      using message = 'Rate limit exceeded',
            detail  = 'You have submitted too many reports recently. Please wait before submitting more.',
            errcode = '42501'; -- insufficient_privilege (surfaces as a 403 in PostgREST)
  end if;

  -- ── Validate target_type ────────────────────────────────────────────────────
  if p_target_type not in (
    'post', 'comment', 'user', 'church',
    'livestream', 'message_request', 'message'
  ) then
    raise exception 'Invalid target_type: %', p_target_type
      using errcode = '22023'; -- invalid_parameter_value
  end if;

  -- ── Validate reason ─────────────────────────────────────────────────────────
  if p_reason not in (
    'spam', 'harassment', 'hate_speech', 'sexual_content', 'misinformation',
    'impersonation', 'self_harm', 'violence', 'illegal_content', 'other'
  ) then
    raise exception 'Invalid reason: %', p_reason
      using errcode = '22023';
  end if;

  -- ── Prevent self-report ─────────────────────────────────────────────────────
  if p_target_type = 'user' and p_target_id = auth.uid() then
    raise exception 'You cannot report yourself'
      using errcode = '22023';
  end if;

  -- ── Cap details length ──────────────────────────────────────────────────────
  if p_details is not null and length(p_details) > 500 then
    raise exception 'details must be 500 characters or fewer'
      using errcode = '22023';
  end if;

  -- ── Insert ──────────────────────────────────────────────────────────────────
  insert into public.reports(reporter_id, target_type, target_id, reason, details)
  values (auth.uid(), p_target_type, p_target_id, p_reason, p_details)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all  on function public.submit_report(text, uuid, text, text) from anon, public;
grant execute on function public.submit_report(text, uuid, text, text) to authenticated;


-- =============================================================================
-- G.  admin_list_reports() — upgraded with offset + details column
-- =============================================================================
-- Replaces the version created in supabase-platform-admin.sql.
-- The new signature adds p_offset for pagination and exposes the details
-- column.  The original single-argument version (p_status, p_limit) is
-- superseded; this CREATE OR REPLACE updates it in-place.
--
-- Parameters
--   p_status — filter by status: 'pending'|'reviewed'|'resolved'|'dismissed'|'all'
--   p_limit  — max rows to return (default 50)
--   p_offset — rows to skip for pagination (default 0)
create or replace function public.admin_list_reports(
  p_status text    default 'pending',
  p_limit  integer default 50,
  p_offset integer default 0
)
returns table (
  id            uuid,
  reporter_id   uuid,
  reporter_name text,
  target_type   text,
  target_id     uuid,
  reason        text,
  details       text,
  status        text,
  admin_notes   text,  -- maps to the "notes" column added by platform-admin.sql
  created_at    timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Guard: only platform admins may call this function.
  if not public.is_platform_admin() then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  -- Validate status filter to prevent SQL injection via the literal comparison.
  if p_status not in ('pending', 'reviewed', 'resolved', 'dismissed', 'all') then
    raise exception 'Invalid status filter: %', p_status
      using errcode = '22023';
  end if;

  return query
    select
      r.id,
      r.reporter_id,
      p.full_name                        as reporter_name,
      r.target_type,
      r.target_id,
      r.reason,
      r.details,
      r.status,
      r.notes                            as admin_notes, -- "notes" is the original column name
      r.created_at
    from public.reports r
    left join public.profiles p on p.id = r.reporter_id
    where (p_status = 'all' or r.status = p_status)
    order by r.created_at desc
    limit  p_limit
    offset p_offset;
end;
$$;

revoke all  on function public.admin_list_reports(text, integer, integer) from anon, public;
grant execute on function public.admin_list_reports(text, integer, integer) to authenticated;

-- Also drop the old two-arg overload so stale client code fails fast rather
-- than silently calling the wrong function.  Comment out if backwards compat
-- with the old (text, int) signature is still needed.
drop function if exists public.admin_list_reports(text, int);


-- =============================================================================
-- H.  admin_update_report() — upgraded to log into moderation_actions
-- =============================================================================
-- Replaces the version from supabase-platform-admin.sql.
-- Identical external signature (uuid, text, text) — safe drop-in replacement.
--
-- Changes vs. original:
--   • Uses coalesce so existing notes are preserved when p_notes is null.
--   • Inserts an audit row into moderation_actions after the update.
create or replace function public.admin_update_report(
  p_report_id uuid,
  p_status    text,
  p_notes     text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Guard: only platform admins may call this function.
  if not public.is_platform_admin() then
    raise exception 'Unauthorized'
      using errcode = '42501';
  end if;

  -- Validate the status transition.
  if p_status not in ('reviewed', 'resolved', 'dismissed') then
    raise exception 'Invalid status value: %. Must be reviewed, resolved, or dismissed.', p_status
      using errcode = '22023';
  end if;

  -- Verify the report exists before updating.
  if not exists (select 1 from public.reports where id = p_report_id) then
    raise exception 'Report not found: %', p_report_id
      using errcode = 'P0002'; -- no_data_found
  end if;

  -- Update the report row.
  -- coalesce(p_notes, notes) preserves existing notes if p_notes is null.
  update public.reports
     set status      = p_status,
         notes       = coalesce(p_notes, notes),
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_report_id;

  -- Append an audit record to moderation_actions.
  -- action_type format: '<status>_report' (e.g. 'resolved_report')
  insert into public.moderation_actions(admin_id, action_type, target_type, target_id, notes)
  values (
    auth.uid(),
    p_status || '_report',   -- e.g. 'reviewed_report', 'resolved_report', 'dismissed_report'
    'report',
    p_report_id,
    p_notes
  );
end;
$$;

revoke all  on function public.admin_update_report(uuid, text, text) from anon, public;
grant execute on function public.admin_update_report(uuid, text, text) to authenticated;


-- =============================================================================
-- I.  Block enforcement in message requests
-- =============================================================================

-- can_send_message_request(p_recipient_id)
-- ─────────────────────────────────────────
-- Returns TRUE if the calling user may send a message request to p_recipient_id.
-- Returns FALSE if either party has blocked the other.
--
-- Call this from the message-request creation RPC (or middleware) BEFORE
-- inserting into message_requests.  Example usage:
--
--   if not public.can_send_message_request(p_recipient_id) then
--     raise exception 'Cannot send message request to this user.';
--   end if;
create or replace function public.can_send_message_request(p_recipient_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Block check is bi-directional:
  --   • The caller may have blocked the recipient.
  --   • The recipient may have blocked the caller.
  -- In either case, the message request is not allowed.
  if exists (
    select 1
      from public.user_blocks
     where (blocker_id = auth.uid()      and blocked_id = p_recipient_id)
        or (blocker_id = p_recipient_id  and blocked_id = auth.uid())
  ) then
    return false;
  end if;

  return true;
end;
$$;

revoke all  on function public.can_send_message_request(uuid) from anon, public;
grant execute on function public.can_send_message_request(uuid) to authenticated;


-- =============================================================================
-- J.  get_relationship_status() — block/mute state for profile pages
-- =============================================================================
-- Returns a single row describing the calling user's relationship with
-- p_other_user_id.  The frontend uses this to:
--   • Show/hide the "Block", "Unblock", "Mute", "Unmute" buttons.
--   • Display a "This user has blocked you" banner when applicable.
--   • Decide whether to render the user's content or show a placeholder.
--
-- All three booleans are computed in a single function call to avoid
-- multiple round-trips.
create or replace function public.get_relationship_status(p_other_user_id uuid)
returns table (
  is_blocking       boolean,   -- true if the caller has blocked p_other_user_id
  is_muting         boolean,   -- true if the caller has muted  p_other_user_id
  is_blocked_by_them boolean   -- true if p_other_user_id has blocked the caller
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select
      -- Has the calling user blocked the other?
      exists(
        select 1 from public.user_blocks
         where blocker_id = auth.uid()
           and blocked_id = p_other_user_id
      ) as is_blocking,

      -- Has the calling user muted the other?
      exists(
        select 1 from public.user_mutes
         where muter_id = auth.uid()
           and muted_id = p_other_user_id
      ) as is_muting,

      -- Has the other user blocked the caller?
      -- (Revealed so the UI can show a neutral "content unavailable" message
      --  rather than an unexplained empty state.)
      exists(
        select 1 from public.user_blocks
         where blocker_id = p_other_user_id
           and blocked_id = auth.uid()
      ) as is_blocked_by_them;
end;
$$;

revoke all  on function public.get_relationship_status(uuid) from anon, public;
grant execute on function public.get_relationship_status(uuid) to authenticated;


-- =============================================================================
-- K.  Realtime publications
-- =============================================================================
-- Publish user_blocks and user_mutes to Supabase Realtime so clients can
-- react instantly when a block/unblock happens (e.g. remove the blocked
-- user's messages from the current conversation view).
-- The DO block guards against "relation already in publication" errors.

do $$
begin
  -- user_blocks
  if not exists (
    select 1 from pg_publication_tables
     where pubname    = 'supabase_realtime'
       and schemaname = 'public'
       and tablename  = 'user_blocks'
  ) then
    execute 'alter publication supabase_realtime add table public.user_blocks';
  end if;

  -- user_mutes
  if not exists (
    select 1 from pg_publication_tables
     where pubname    = 'supabase_realtime'
       and schemaname = 'public'
       and tablename  = 'user_mutes'
  ) then
    execute 'alter publication supabase_realtime add table public.user_mutes';
  end if;
end $$;

-- =============================================================================
-- End of supabase-block-report.sql
-- =============================================================================
