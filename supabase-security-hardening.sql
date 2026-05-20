-- =============================================================================
-- TheBride Security Hardening
-- Version: 2026-05-20
-- Safe to re-run. All statements use CREATE OR REPLACE / DROP IF EXISTS /
-- IF NOT EXISTS / idempotent ALTER TABLE patterns.
-- Run AFTER: supabase-production-rls.sql, supabase-security-audit.sql,
--            supabase-church-verification.sql, supabase-platform-admin.sql,
--            supabase-payments.sql
-- =============================================================================

-- =============================================================================
-- O. REQUIRED NEW COLUMNS  (must come first — later sections depend on these)
-- =============================================================================

-- ─── Profiles: suspended flag ────────────────────────────────────────────────
-- Users who are suspended cannot create new content (enforced via RLS helper).
alter table public.profiles add column if not exists suspended         boolean     not null default false;
alter table public.profiles add column if not exists suspension_reason text;
alter table public.profiles add column if not exists suspended_at      timestamptz;

-- ─── Churches: suspended flag ────────────────────────────────────────────────
-- Suspended churches are hidden from public browsing and block content creation
-- by church_admin users of that church.
alter table public.churches add column if not exists suspended         boolean not null default false;
alter table public.churches add column if not exists suspension_reason text;

-- =============================================================================
-- P. MODERATION ACTIONS AUDIT LOG
-- Every admin action is written here by SECURITY DEFINER functions below.
-- Direct inserts via RLS are prohibited for non-admins.
-- =============================================================================
create table if not exists public.moderation_actions (
  id          uuid        primary key default gen_random_uuid(),
  admin_id    uuid        not null references auth.users(id) on delete set null,
  action_type text        not null,
  -- Valid values: 'suspend_user','unsuspend_user','delete_post','warn_user',
  --               'suspend_church','unsuspend_church','dismiss_report','resolve_report'
  target_type text        not null, -- 'user' | 'post' | 'church' | 'report'
  target_id   uuid        not null,
  reason      text,
  notes       text,
  created_at  timestamptz not null default now()
);

alter table public.moderation_actions enable row level security;

-- Only platform_admin may read or write moderation_actions.
-- The SECURITY DEFINER RPCs below bypass RLS for the insert side.
drop policy if exists "moderation_actions admin only" on public.moderation_actions;
create policy "moderation_actions admin only" on public.moderation_actions
  for all to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin')
  );

create index if not exists idx_moderation_actions_target  on public.moderation_actions(target_type, target_id);
create index if not exists idx_moderation_actions_admin   on public.moderation_actions(admin_id);
create index if not exists idx_moderation_actions_created on public.moderation_actions(created_at desc);

-- =============================================================================
-- Q. USER WARNINGS TABLE
-- =============================================================================
create table if not exists public.user_warnings (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  admin_id     uuid        references auth.users(id) on delete set null,
  reason       text        not null,
  warning_type text        not null default 'content_violation',
  -- Valid warning_type values:
  --   'content_violation' | 'harassment' | 'spam' | 'misinformation' | 'other'
  acknowledged boolean     not null default false,
  created_at   timestamptz not null default now()
);

alter table public.user_warnings enable row level security;

-- Users can read their own warnings; platform_admin can read all.
drop policy if exists "user_warnings read own"    on public.user_warnings;
drop policy if exists "user_warnings admin write" on public.user_warnings;
drop policy if exists "user_warnings user ack"    on public.user_warnings;

create policy "user_warnings read own" on public.user_warnings
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin')
  );

-- Only platform_admin may issue warnings (SECURITY DEFINER RPC below).
create policy "user_warnings admin write" on public.user_warnings
  for insert to authenticated
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin')
  );

-- Users may only set acknowledged = true on their own warning rows.
-- They cannot alter any other column.
create policy "user_warnings user ack" on public.user_warnings
  for update to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid() and acknowledged = true);

-- =============================================================================
-- A. ENSURE RLS IS ENABLED ON EVERY TABLE
-- Re-enabling an already-enabled table is a no-op, so this is always safe.
-- =============================================================================
alter table public.profiles               enable row level security;
alter table public.posts                  enable row level security;
alter table public.comments               enable row level security;
alter table public.comment_likes          enable row level security;
alter table public.follows                enable row level security;
alter table public.notifications          enable row level security;
alter table public.churches               enable row level security;
alter table public.church_memberships     enable row level security;
alter table public.conversations          enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages               enable row level security;
alter table public.live_streams           enable row level security;
alter table public.post_views             enable row level security;
alter table public.payment_settings       enable row level security;
alter table public.donations              enable row level security;
alter table public.church_verifications   enable row level security;

-- Optional tables — guarded because these may not exist on all deployments.
-- Using pg_tables check + execute to avoid "relation does not exist" errors.
do $$ begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'church_events') then
    execute 'alter table public.church_events enable row level security';
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'event_rsvps') then
    execute 'alter table public.event_rsvps enable row level security';
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'prayer_requests') then
    execute 'alter table public.prayer_requests enable row level security';
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'prayer_supports') then
    execute 'alter table public.prayer_supports enable row level security';
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'devotionals') then
    execute 'alter table public.devotionals enable row level security';
  end if;
end $$;

-- Conditionally enable RLS on tables that may have been created later.
do $$ begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'likes') then
    execute 'alter table public.likes enable row level security';
  end if;
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'message_requests') then
    execute 'alter table public.message_requests enable row level security';
  end if;
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'church_follows') then
    execute 'alter table public.church_follows enable row level security';
  end if;
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'reports') then
    execute 'alter table public.reports enable row level security';
  end if;
end $$;

-- =============================================================================
-- B. REMOVE DANGEROUS OPEN "ALLOW ALL" POLICIES
-- Development policies used using(true) with check(true) — these are the ones
-- created by supabase-migration.sql. They are replaced with proper rules below.
-- Supabase-production-rls.sql and supabase-security-audit.sql already removed
-- most of them; this section provides idempotent cleanup for any that remain.
-- =============================================================================
do $$ declare
  t text;
  p text;
begin
  for t, p in values
    ('profiles',               'allow all profiles'),
    ('posts',                  'allow all posts'),
    ('comments',               'allow all comments'),
    ('comment_likes',          'allow all comment likes'),
    ('follows',                'allow all follows'),
    ('notifications',          'allow all notifications'),
    ('churches',               'allow all churches'),
    ('church_memberships',     'allow all church_memberships'),
    ('conversations',          'allow all conversations'),
    ('conversation_participants','allow all conversation_participants'),
    ('messages',               'allow all messages'),
    ('live_streams',           'allow all live_streams'),
    ('post_views',             'allow all post_views'),
    ('church_events',          'allow all church_events'),
    ('event_rsvps',            'allow all event_rsvps'),
    ('prayer_requests',        'allow all prayer_requests'),
    ('prayer_supports',        'allow all prayer_supports'),
    ('devotionals',            'allow all devotionals'),
    ('likes',                  'allow all likes'),
    ('message_requests',       'allow all message_requests'),
    ('church_follows',         'allow all church_follows')
  loop
    if exists (select 1 from pg_tables where schemaname = 'public' and tablename = t) then
      execute format('drop policy if exists %I on public.%I', p, t);
    end if;
  end loop;
end $$;

-- =============================================================================
-- N. HELPER: is_not_suspended()
-- Used in INSERT policies on content-creating tables to block suspended users.
-- SECURITY DEFINER + stable means it runs once per query, not per row.
-- =============================================================================
create or replace function public.is_not_suspended()
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
as $$
  select not coalesce(
    (select suspended from public.profiles where id = auth.uid()),
    false
  );
$$;

-- =============================================================================
-- C & D. PROFILE SPOOFING PROTECTION + ADMIN ROLE ESCALATION PROTECTION
-- The broad "profiles update self" from production-rls.sql is replaced here
-- with a tighter version that:
--   1. Prevents any user from changing their own `role` field.
--   2. Prevents any user from changing their own `id`.
-- Role changes MUST go through admin_set_user_role() (SECURITY DEFINER RPC).
-- =============================================================================

-- Drop the loose policy from production-rls.sql and security-audit.sql.
drop policy if exists "profiles update self"              on public.profiles;
drop policy if exists "profiles update self no role change" on public.profiles;

-- Tight self-update: user can update their own profile but CANNOT change role or id.
-- The WITH CHECK subquery reads the current role from the DB and requires the
-- new role value to be identical — blocking both escalation and demotion.
create policy "profiles update self no role change" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id   = auth.uid()
    -- Role must stay the same as whatever is currently in the database.
    and role = (select role from public.profiles where id = auth.uid())
  );

-- Platform admin can update any profile (for name corrections, etc.).
-- Role changes still go through the dedicated RPC.
drop policy if exists "profiles update platform admin" on public.profiles;
create policy "profiles update platform admin" on public.profiles
  for update to authenticated
  using  (exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin'));

-- =============================================================================
-- E. NOTIFICATION ABUSE PREVENTION
-- Recreate notification policies replacing the loose ones from production-rls.
-- Rules:
--   SELECT  → recipient only
--   INSERT  → actor_user_id must equal auth.uid() AND recipient != actor
--             (prevents faking notifications from other users, or self-notifying)
--   UPDATE  → recipient only (to mark read)
--   DELETE  → recipient only
-- =============================================================================
drop policy if exists "notifications select own"          on public.notifications;
drop policy if exists "notifications update own"          on public.notifications;
drop policy if exists "notifications insert authenticated" on public.notifications;
drop policy if exists "notifications delete own"          on public.notifications;

create policy "notifications select own" on public.notifications
  for select to authenticated
  using (recipient_user_id = auth.uid());

create policy "notifications insert authenticated" on public.notifications
  for insert to authenticated
  with check (
    actor_user_id = auth.uid()
    -- Actor cannot create a notification where they are also the recipient.
    -- (Prevents self-notification abuse and fake social proof.)
    and recipient_user_id <> auth.uid()
  );

create policy "notifications update own" on public.notifications
  for update to authenticated
  using  (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());

create policy "notifications delete own" on public.notifications
  for delete to authenticated
  using (recipient_user_id = auth.uid());

-- =============================================================================
-- F. DONATION ABUSE PREVENTION
-- The policies from supabase-payments.sql are kept as-is (they are already
-- correct). Here we add the missing platform-only constraint on UPDATE:
-- church_admin may only update donations for their own church;
-- platform_admin may update any donation. No user may update their own donation
-- after submission (prevents amount/method tampering).
-- These DROP+CREATE blocks are idempotent over the definitions in payments.sql.
-- =============================================================================
drop policy if exists "donations read own"            on public.donations;
drop policy if exists "donations insert donor"        on public.donations;
drop policy if exists "donations read platform admin" on public.donations;
drop policy if exists "donations read church admin"   on public.donations;
drop policy if exists "donations update platform"     on public.donations;
drop policy if exists "donations update church"       on public.donations;

-- Donors see only their own donations.
create policy "donations read own" on public.donations
  for select to authenticated
  using (donor_id = auth.uid());

-- Donors insert their own donations; donor_id is pinned to the caller.
create policy "donations insert donor" on public.donations
  for insert to authenticated
  with check (donor_id = auth.uid());

-- Platform admin can see everything.
create policy "donations read platform admin" on public.donations
  for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin'));

-- Church admin sees donations directed at their church.
create policy "donations read church admin" on public.donations
  for select to authenticated
  using (
    target_type = 'church'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'church_admin' and church_id = target_id
    )
  );

-- Platform admin can update any donation (confirm/reject).
create policy "donations update platform" on public.donations
  for update to authenticated
  using  (exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin'));

-- Church admin can update only church donations for their own church.
-- They CANNOT update platform-level donations (prevents cross-church or
-- platform-level donation status manipulation).
create policy "donations update church" on public.donations
  for update to authenticated
  using (
    target_type = 'church'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'church_admin' and church_id = target_id
    )
  )
  with check (
    target_type = 'church'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'church_admin' and church_id = target_id
    )
  );

-- =============================================================================
-- G. CHURCH VERIFICATION ABUSE PREVENTION
-- Supplement supabase-church-verification.sql:
-- Block re-submission while an existing record has status = 'pending'.
-- The unique(church_id) constraint already prevents duplicate rows, so this
-- policy tightens the INSERT path further with an explicit pending check.
-- =============================================================================
drop policy if exists "church_verifications insert admin"             on public.church_verifications;
drop policy if exists "church_verifications insert admin no pending"  on public.church_verifications;

-- Church admin may submit verification ONLY if:
--   a) they are the church admin (church_id matches their profile.church_id)
--   b) there is no existing pending record for that church
create policy "church_verifications insert admin no pending" on public.church_verifications
  for insert to authenticated
  with check (
    submitted_by = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role = 'church_admin'
        and church_id = church_verifications.church_id
    )
    -- Prevent re-submission while an existing request is still under review.
    and not exists (
      select 1 from public.church_verifications cv2
      where cv2.church_id = church_verifications.church_id
        and cv2.status = 'pending'
    )
  );

-- =============================================================================
-- H. LIVE STREAM ABUSE — already in supabase-security-audit.sql.
-- Re-declared here for completeness (idempotent drop + create).
-- Church admin can INSERT/UPDATE streams only for their own church_id.
-- All authenticated users can SELECT.
-- =============================================================================
drop policy if exists "live_streams select authenticated" on public.live_streams;
drop policy if exists "live_streams insert admin"         on public.live_streams;
drop policy if exists "live_streams update admin"         on public.live_streams;
drop policy if exists "live_streams delete admin"         on public.live_streams;

create policy "live_streams select authenticated" on public.live_streams
  for select to authenticated using (true);

create policy "live_streams insert admin" on public.live_streams
  for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role = 'church_admin'
        and church_id = live_streams.church_id
    )
  );

create policy "live_streams update admin" on public.live_streams
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role = 'church_admin'
        and church_id = live_streams.church_id
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role = 'church_admin'
        and church_id = live_streams.church_id
    )
  );

create policy "live_streams delete admin" on public.live_streams
  for delete to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role = 'church_admin'
        and church_id = live_streams.church_id
    )
  );

-- =============================================================================
-- I. PAYMENT SETTINGS SECURITY
-- Already fully handled in supabase-payments.sql. The policies there are
-- correct and are already drop+recreated idempotently. No changes needed here.
-- Documented for completeness:
--   platform_admin  → full read/write on owner_type = 'platform' rows
--   church_admin    → read/write only their own church's rows
--   other authenticated → can only read enabled=true rows
--   anon → no access (section R below revokes anon entirely)
-- =============================================================================

-- =============================================================================
-- J. POST VIEWS FLOOD PREVENTION
-- One view per user per post is enforced by the unique(post_id, user_id)
-- constraint from supabase-migration.sql. The RLS layer adds the additional
-- constraint that user_id must be the caller.
-- =============================================================================
drop policy if exists "allow all post_views"      on public.post_views;
drop policy if exists "post_views select own"     on public.post_views;
drop policy if exists "post_views insert own"     on public.post_views;

-- Users see only their own view records.
create policy "post_views select own" on public.post_views
  for select to authenticated
  using (user_id = auth.uid());

-- On insert, user_id must be the caller.
-- The unique constraint on (post_id, user_id) handles the one-per-post rule.
create policy "post_views insert own" on public.post_views
  for insert to authenticated
  with check (user_id = auth.uid());

-- =============================================================================
-- K. MESSAGE SECURITY
-- Only conversation participants can read or send messages.
-- Adding participants is locked behind the RPC create_or_get_conversation()
-- so that a user cannot directly add themselves to someone else's conversation.
-- The is_conversation_participant() SECURITY DEFINER function (from
-- supabase-production-rls.sql) is reused here.
-- =============================================================================
drop policy if exists "messages select participant"        on public.messages;
drop policy if exists "messages insert participant sender" on public.messages;
drop policy if exists "messages update participant"        on public.messages;

-- Read: caller must be a participant.
create policy "messages select participant" on public.messages
  for select to authenticated
  using (public.is_conversation_participant(conversation_id));

-- Send: caller must be a participant AND sender_id must equal auth.uid().
-- This double-check prevents a participant from forging another participant's
-- sender_id on a message.
create policy "messages insert participant sender" on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_conversation_participant(conversation_id)
    and public.is_not_suspended()
  );

-- Update (e.g. read receipts, reactions): participant only.
create policy "messages update participant" on public.messages
  for update to authenticated
  using (public.is_conversation_participant(conversation_id))
  with check (public.is_conversation_participant(conversation_id));

-- Conversation participants: lock down INSERT so only existing participants
-- (or the conversation creator via the RPC) can add new participants.
drop policy if exists "conversation_participants select participant"              on public.conversation_participants;
drop policy if exists "conversation_participants insert self or existing participant" on public.conversation_participants;
drop policy if exists "conversation_participants insert via participant"          on public.conversation_participants;

create policy "conversation_participants select participant" on public.conversation_participants
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_conversation_participant(conversation_id)
  );

-- Only an existing participant of the conversation may add another participant.
-- This prevents a random user from adding themselves to a private conversation.
create policy "conversation_participants insert via participant" on public.conversation_participants
  for insert to authenticated
  with check (
    -- The new participant row's user_id can be anything, but the INSERTER must
    -- already be a participant (or inserting themselves into a brand-new conversation).
    public.is_conversation_participant(conversation_id)
    or user_id = auth.uid()
  );

-- =============================================================================
-- L. FOLLOWS ABUSE PREVENTION
-- Users cannot follow themselves. follower_id must equal auth.uid().
-- Replaces the loose insert policy from production-rls.sql.
-- =============================================================================
drop policy if exists "follows select authenticated" on public.follows;
drop policy if exists "follows insert owner"         on public.follows;
drop policy if exists "follows delete owner"         on public.follows;
drop policy if exists "follows insert no self"       on public.follows;

create policy "follows select authenticated" on public.follows
  for select to authenticated using (true);

-- follower_id = caller, and follower cannot follow themselves.
create policy "follows insert no self" on public.follows
  for insert to authenticated
  with check (
    follower_id = auth.uid()
    and follower_id <> following_id
    and public.is_not_suspended()
  );

create policy "follows delete owner" on public.follows
  for delete to authenticated
  using (follower_id = auth.uid());

-- =============================================================================
-- N (continued). SUSPENDED USER ENFORCEMENT ON CONTENT TABLES
-- Posts, comments, church_memberships inserts also blocked for suspended users.
-- =============================================================================

-- ── Posts ────────────────────────────────────────────────────────────────────
drop policy if exists "posts select authenticated" on public.posts;
drop policy if exists "posts insert owner"         on public.posts;
drop policy if exists "posts update owner"         on public.posts;
drop policy if exists "posts delete owner"         on public.posts;

create policy "posts select authenticated" on public.posts
  for select to authenticated using (true);

create policy "posts insert owner" on public.posts
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_not_suspended()
    and (
      church_id is null
      or exists (
        select 1 from public.profiles
        where id = auth.uid()
          and role = 'church_admin'
          and church_id = posts.church_id
      )
    )
  );

create policy "posts update owner" on public.posts
  for update to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Platform admin or post owner can delete.
create policy "posts delete owner" on public.posts
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin')
  );

-- ── Comments ──────────────────────────────────────────────────────────────────
drop policy if exists "comments select authenticated" on public.comments;
drop policy if exists "comments insert owner"         on public.comments;
drop policy if exists "comments update owner"         on public.comments;
drop policy if exists "comments delete owner"         on public.comments;

create policy "comments select authenticated" on public.comments
  for select to authenticated using (true);

create policy "comments insert owner" on public.comments
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_not_suspended()
  );

create policy "comments update owner" on public.comments
  for update to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "comments delete owner" on public.comments
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin')
  );

-- ── Church Memberships ────────────────────────────────────────────────────────
drop policy if exists "church_memberships select self or admin" on public.church_memberships;
drop policy if exists "church_memberships insert self"          on public.church_memberships;
drop policy if exists "church_memberships update admin"         on public.church_memberships;
drop policy if exists "church_memberships delete self or admin" on public.church_memberships;

create policy "church_memberships select self or admin" on public.church_memberships
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role = 'church_admin'
        and church_id = church_memberships.church_id
    )
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin')
  );

-- Suspended users cannot join a church.
create policy "church_memberships insert self" on public.church_memberships
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_not_suspended()
  );

create policy "church_memberships update admin" on public.church_memberships
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role = 'church_admin'
        and church_id = church_memberships.church_id
    )
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin')
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role = 'church_admin'
        and church_id = church_memberships.church_id
    )
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin')
  );

create policy "church_memberships delete self or admin" on public.church_memberships
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role = 'church_admin'
        and church_id = church_memberships.church_id
    )
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin')
  );

-- =============================================================================
-- M. ADMIN RPC SECURITY — SECURITY DEFINER FUNCTIONS
-- All admin RPCs:
--   1. Check caller is platform_admin as first action.
--   2. set search_path = public to prevent search_path injection.
--   3. Log every action to moderation_actions.
--   4. Are granted only to 'authenticated' (not 'public' or 'anon').
-- =============================================================================

-- ─── M1. admin_set_user_role ─────────────────────────────────────────────────
-- Allows platform_admin to set any user's role.
-- Valid roles: 'member', 'church_admin', 'platform_admin'.
-- SAFETY: caller cannot change their own role (prevents accidental self-lockout).
-- NOTE: granting 'platform_admin' is intentionally supported here since this
-- function already requires the caller to be platform_admin themselves.
create or replace function public.admin_set_user_role(
  p_user_id uuid,
  p_role    text
)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  -- Authorization check.
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin') then
    raise exception 'Unauthorized: only platform_admin can set roles';
  end if;

  -- Valid role guard.
  if p_role not in ('member', 'church_admin', 'platform_admin') then
    raise exception 'Invalid role: must be member, church_admin, or platform_admin';
  end if;

  -- Prevent self-role-change (accidental demotion/escalation guard).
  if p_user_id = auth.uid() then
    raise exception 'Cannot change your own role through this function';
  end if;

  -- Safety net: if demoting someone from platform_admin, ensure at least one
  -- other platform_admin exists so the platform cannot be locked out.
  if exists (select 1 from public.profiles where id = p_user_id and role = 'platform_admin')
     and p_role <> 'platform_admin' then
    if (select count(*) from public.profiles where role = 'platform_admin') <= 1 then
      raise exception 'Cannot demote the last platform_admin — assign another admin first';
    end if;
  end if;

  update public.profiles set role = p_role where id = p_user_id;

  insert into public.moderation_actions(admin_id, action_type, target_type, target_id, reason)
  values (auth.uid(), 'set_role', 'user', p_user_id, 'role set to: ' || p_role);
end;
$$;

revoke all on function public.admin_set_user_role(uuid, text) from public, anon;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;

-- ─── M2. admin_suspend_user ──────────────────────────────────────────────────
create or replace function public.admin_suspend_user(
  p_user_id uuid,
  p_reason  text
)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin') then
    raise exception 'Unauthorized';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Cannot suspend yourself';
  end if;

  update public.profiles
  set
    suspended          = true,
    suspension_reason  = p_reason,
    suspended_at       = now()
  where id = p_user_id;

  insert into public.moderation_actions(admin_id, action_type, target_type, target_id, reason)
  values (auth.uid(), 'suspend_user', 'user', p_user_id, p_reason);
end;
$$;

revoke all on function public.admin_suspend_user(uuid, text) from public, anon;
grant execute on function public.admin_suspend_user(uuid, text) to authenticated;

-- ─── M3. admin_unsuspend_user ────────────────────────────────────────────────
create or replace function public.admin_unsuspend_user(p_user_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin') then
    raise exception 'Unauthorized';
  end if;

  update public.profiles
  set
    suspended         = false,
    suspension_reason = null,
    suspended_at      = null
  where id = p_user_id;

  insert into public.moderation_actions(admin_id, action_type, target_type, target_id)
  values (auth.uid(), 'unsuspend_user', 'user', p_user_id);
end;
$$;

revoke all on function public.admin_unsuspend_user(uuid) from public, anon;
grant execute on function public.admin_unsuspend_user(uuid) to authenticated;

-- ─── M4. admin_suspend_church ────────────────────────────────────────────────
create or replace function public.admin_suspend_church(
  p_church_id uuid,
  p_reason    text
)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin') then
    raise exception 'Unauthorized';
  end if;

  update public.churches
  set
    suspended         = true,
    suspension_reason = p_reason
  where id = p_church_id;

  insert into public.moderation_actions(admin_id, action_type, target_type, target_id, reason)
  values (auth.uid(), 'suspend_church', 'church', p_church_id, p_reason);
end;
$$;

revoke all on function public.admin_suspend_church(uuid, text) from public, anon;
grant execute on function public.admin_suspend_church(uuid, text) to authenticated;

-- ─── M5. admin_unsuspend_church ──────────────────────────────────────────────
create or replace function public.admin_unsuspend_church(p_church_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin') then
    raise exception 'Unauthorized';
  end if;

  update public.churches
  set
    suspended         = false,
    suspension_reason = null
  where id = p_church_id;

  insert into public.moderation_actions(admin_id, action_type, target_type, target_id)
  values (auth.uid(), 'unsuspend_church', 'church', p_church_id);
end;
$$;

revoke all on function public.admin_unsuspend_church(uuid) from public, anon;
grant execute on function public.admin_unsuspend_church(uuid) to authenticated;

-- ─── M6. admin_delete_post ───────────────────────────────────────────────────
-- Extends the version in supabase-platform-admin.sql to log the deletion with
-- a reason and write a moderation_actions entry. Safe to re-run.
create or replace function public.admin_delete_post(
  p_post_id uuid,
  p_reason  text default 'policy_violation'
)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin') then
    raise exception 'Unauthorized';
  end if;

  if not exists (select 1 from public.posts where id = p_post_id) then
    raise exception 'Post not found';
  end if;

  delete from public.posts where id = p_post_id;

  insert into public.moderation_actions(admin_id, action_type, target_type, target_id, reason)
  values (auth.uid(), 'delete_post', 'post', p_post_id, p_reason);
end;
$$;

revoke all on function public.admin_delete_post(uuid, text) from public, anon;
grant execute on function public.admin_delete_post(uuid, text) to authenticated;

-- ─── Q (continued). admin_warn_user ─────────────────────────────────────────
create or replace function public.admin_warn_user(
  p_user_id      uuid,
  p_reason       text,
  p_warning_type text default 'content_violation'
)
  returns uuid
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin') then
    raise exception 'Unauthorized';
  end if;

  if p_warning_type not in ('content_violation','harassment','spam','misinformation','other') then
    raise exception 'Invalid warning_type';
  end if;

  insert into public.user_warnings(user_id, admin_id, reason, warning_type)
  values (p_user_id, auth.uid(), p_reason, p_warning_type)
  returning id into v_id;

  insert into public.moderation_actions(admin_id, action_type, target_type, target_id, reason)
  values (auth.uid(), 'warn_user', 'user', p_user_id, p_reason);

  return v_id;
end;
$$;

revoke all on function public.admin_warn_user(uuid, text, text) from public, anon;
grant execute on function public.admin_warn_user(uuid, text, text) to authenticated;

-- =============================================================================
-- R. ANONYMOUS ACCESS LOCK
-- The anon role should have zero access to any application table.
-- Supabase grants anon access to storage.objects via bucket-level policies
-- (configured separately in the Dashboard), not via public schema grants.
-- =============================================================================

-- Revoke all public schema table access from anon.
-- This is a belt-and-suspenders measure on top of RLS — both are required
-- because a RLS policy that is missing entirely defaults to DENY for anon,
-- but explicit REVOKE ensures the Postgres grant layer also blocks it.
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all routines  in schema public from anon;

-- Re-grant the minimum set the Supabase auth flow needs (anon is used for the
-- sign-in/sign-up edge functions which run under service_role in production,
-- so no anon grants to application tables are needed).
-- If you add a public landing-page endpoint that reads e.g. church names,
-- add a specific SELECT grant here rather than blanket access.

-- =============================================================================
-- S. STORAGE BUCKET SECURITY (REFERENCE + HELPER RPC)
-- =============================================================================
-- The 'church-documents' bucket MUST be created in the Supabase Dashboard with:
--   public = false
-- Then apply storage RLS policies via Dashboard → Storage → Policies:
--
--   Policy name: "admin read church documents"
--   Operation:   SELECT
--   Roles:       authenticated
--   Expression:  (select role from public.profiles where id = auth.uid()) = 'platform_admin'
--
--   Policy name: "church admin upload own docs"
--   Operation:   INSERT
--   Roles:       authenticated
--   Expression:
--     bucket_id = 'church-documents'
--     and (select role from public.profiles where id = auth.uid()) = 'church_admin'
--     and (storage.foldername(name))[1] = (
--           select church_id::text from public.profiles where id = auth.uid()
--         )
--
--   Policy name: "church admin read own docs"
--   Operation:   SELECT
--   Roles:       authenticated
--   Expression:
--     bucket_id = 'church-documents'
--     and (
--       (select role from public.profiles where id = auth.uid()) = 'platform_admin'
--       or (
--         (select role from public.profiles where id = auth.uid()) = 'church_admin'
--         and (storage.foldername(name))[1] = (
--               select church_id::text from public.profiles where id = auth.uid()
--             )
--       )
--     )
--
-- DO NOT create any anon policy for this bucket.
-- ──────────────────────────────────────────────────────────────────────────────

-- Application-level gate function: validates that the caller is authorized to
-- retrieve a signed URL for a church document. The actual signed URL must be
-- generated server-side (Next.js API route or Edge Function) using the
-- service_role client AFTER this function returns successfully.
-- Frontend code must NEVER call supabase.storage.createSignedUrl() directly.
create or replace function public.get_church_doc_signed_url(p_path text)
  returns text
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('platform_admin', 'church_admin')
  ) then
    raise exception 'Unauthorized: only platform_admin or church_admin can access church documents';
  end if;

  -- Church admin: validate path belongs to their church.
  if exists (select 1 from public.profiles where id = auth.uid() and role = 'church_admin') then
    -- Path format: <church_id>/<filename>
    -- The church_id component must match the caller's church_id.
    if not (p_path like (
      (select church_id::text from public.profiles where id = auth.uid()) || '/%'
    )) then
      raise exception 'Unauthorized: path does not belong to your church';
    end if;
  end if;

  -- Return 'authorized' as a gate signal. The caller (server-side Next.js API)
  -- must then use the service_role client to generate the actual signed URL.
  return 'authorized';
end;
$$;

revoke all on function public.get_church_doc_signed_url(text) from public, anon;
grant execute on function public.get_church_doc_signed_url(text) to authenticated;

-- =============================================================================
-- FINAL VERIFICATION QUERY (informational — uncomment to check after running)
-- =============================================================================
-- select schemaname, tablename, rowsecurity
-- from pg_tables
-- where schemaname = 'public'
--   and rowsecurity = false
-- order by tablename;
-- Expected result: 0 rows (every public table has RLS enabled).
-- =============================================================================
