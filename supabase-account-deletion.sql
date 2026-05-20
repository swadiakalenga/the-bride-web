-- =============================================================================
-- TheBride Account Deletion RPC
-- Version: 2026-05-20
-- Strategy: SOFT DELETE with 30-day grace period (App Store / Play Store compliant)
-- Safe to re-run — idempotent.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add soft-delete columns to profiles (idempotent)
-- ---------------------------------------------------------------------------
alter table profiles
  add column if not exists deleted_at timestamptz default null,
  add column if not exists deletion_requested_at timestamptz default null,
  add column if not exists deletion_reason text default null;

-- ---------------------------------------------------------------------------
-- 2. Deletion request log table
-- ---------------------------------------------------------------------------
create table if not exists account_deletion_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  reason        text,
  requested_at  timestamptz not null default now(),
  scheduled_for timestamptz not null default (now() + interval '30 days'),
  executed_at   timestamptz default null,
  cancelled_at  timestamptz default null,
  status        text not null default 'pending'
    check (status in ('pending', 'executed', 'cancelled'))
);

alter table account_deletion_requests enable row level security;

-- Users can see their own deletion request
drop policy if exists "user sees own deletion request" on account_deletion_requests;
create policy "user sees own deletion request"
  on account_deletion_requests for select
  using (user_id = auth.uid());

-- Admins can see all
drop policy if exists "admin sees all deletion requests" on account_deletion_requests;
create policy "admin sees all deletion requests"
  on account_deletion_requests for all
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'platform_admin')
  );

-- ---------------------------------------------------------------------------
-- 3. request_account_deletion() — called by user from in-app settings
--    Soft-deletes the account: marks it for deletion in 30 days.
--    The user is immediately deactivated (suspended = true).
--    Their auth account is NOT deleted yet — the grace period allows cancellation.
-- ---------------------------------------------------------------------------
create or replace function request_account_deletion(p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id    uuid := auth.uid();
  v_existing   account_deletion_requests%rowtype;
  v_request_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Check if a pending request already exists
  select * into v_existing
  from account_deletion_requests
  where user_id = v_user_id and status = 'pending'
  limit 1;

  if found then
    return jsonb_build_object(
      'status', 'already_requested',
      'scheduled_for', v_existing.scheduled_for
    );
  end if;

  -- Soft-deactivate: mark deletion requested
  update profiles
  set
    deletion_requested_at = now(),
    deletion_reason = p_reason,
    suspended = true
  where id = v_user_id;

  -- Create deletion request record
  insert into account_deletion_requests (user_id, reason, scheduled_for)
  values (v_user_id, p_reason, now() + interval '30 days')
  returning id into v_request_id;

  return jsonb_build_object(
    'status', 'requested',
    'request_id', v_request_id,
    'scheduled_for', now() + interval '30 days'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. cancel_account_deletion() — user changes their mind within 30 days
-- ---------------------------------------------------------------------------
create or replace function cancel_account_deletion()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Cancel the pending request
  update account_deletion_requests
  set status = 'cancelled', cancelled_at = now()
  where user_id = v_user_id and status = 'pending';

  if not found then
    return jsonb_build_object('status', 'no_pending_request');
  end if;

  -- Reactivate the account
  update profiles
  set
    deletion_requested_at = null,
    deletion_reason = null,
    suspended = false
  where id = v_user_id;

  return jsonb_build_object('status', 'cancelled');
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. admin_execute_deletion(p_user_id) — run after 30-day grace period
--    Called by a cron job or admin action.
--    Permanently deletes all personal data, then removes auth.users entry.
-- ---------------------------------------------------------------------------
create or replace function admin_execute_deletion(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
begin
  -- Caller must be platform_admin
  select role into v_caller_role from profiles where id = auth.uid();
  if v_caller_role <> 'platform_admin' then
    raise exception 'Unauthorized';
  end if;

  -- Anonymise personal data in profiles
  update profiles set
    full_name        = '[deleted]',
    bio              = null,
    avatar_url       = null,
    city             = null,
    country          = null,
    church_id        = null,
    deleted_at       = now(),
    suspended        = true,
    deletion_reason  = null
  where id = p_user_id;

  -- Delete user content
  delete from posts             where user_id = p_user_id;
  delete from comments          where user_id = p_user_id;
  delete from follows           where follower_id = p_user_id or following_id = p_user_id;
  delete from notifications     where recipient_user_id = p_user_id;
  delete from prayer_requests   where user_id = p_user_id;
  delete from devotionals       where author_id = p_user_id;

  -- Mark deletion request as executed
  update account_deletion_requests
  set status = 'executed', executed_at = now()
  where user_id = p_user_id and status = 'pending';

  -- Log the moderation action
  insert into moderation_actions (admin_id, target_user_id, action, reason)
  values (auth.uid(), p_user_id, 'account_deleted', 'grace period elapsed')
  on conflict do nothing;

  -- Delete auth user (this cascades to all auth-linked data)
  delete from auth.users where id = p_user_id;

  return jsonb_build_object('status', 'deleted', 'user_id', p_user_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. get_deletion_request_status() — frontend polls this to show current state
-- ---------------------------------------------------------------------------
create or replace function get_deletion_request_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_req     account_deletion_requests%rowtype;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_req
  from account_deletion_requests
  where user_id = v_user_id and status = 'pending'
  order by requested_at desc
  limit 1;

  if not found then
    return jsonb_build_object('has_pending_request', false);
  end if;

  return jsonb_build_object(
    'has_pending_request', true,
    'request_id',          v_req.id,
    'requested_at',        v_req.requested_at,
    'scheduled_for',       v_req.scheduled_for
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. admin_list_pending_deletions() — for admin dashboard
-- ---------------------------------------------------------------------------
create or replace function admin_list_pending_deletions()
returns table (
  user_id        uuid,
  full_name      text,
  email          text,
  requested_at   timestamptz,
  scheduled_for  timestamptz,
  reason         text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'platform_admin') then
    raise exception 'Unauthorized';
  end if;

  return query
  select
    adr.user_id,
    p.full_name,
    u.email::text,
    adr.requested_at,
    adr.scheduled_for,
    adr.reason
  from account_deletion_requests adr
  join profiles p on p.id = adr.user_id
  join auth.users u on u.id = adr.user_id
  where adr.status = 'pending'
  order by adr.scheduled_for asc;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. data_deletion_requests — for unauthenticated form submissions from /legal/data-deletion
-- ---------------------------------------------------------------------------
create table if not exists data_deletion_requests (
  id           uuid primary key default gen_random_uuid(),
  full_name    text not null check (char_length(full_name) <= 200),
  email        text not null check (email ~* '^[^@]+@[^@]+\.[^@]+$'),
  request_type text not null default 'full_deletion'
    check (request_type in ('full_deletion', 'specific_data', 'data_export')),
  details      text check (char_length(details) <= 2000),
  submitted_at timestamptz not null default now(),
  status       text not null default 'pending'
    check (status in ('pending', 'processed', 'rejected'))
);

alter table data_deletion_requests enable row level security;

-- Anyone can submit (form is accessible without login)
drop policy if exists "anyone can submit data deletion request" on data_deletion_requests;
create policy "anyone can submit data deletion request"
  on data_deletion_requests for insert
  with check (true);

-- Platform admins can read all
drop policy if exists "admin reads data deletion requests" on data_deletion_requests;
create policy "admin reads data deletion requests"
  on data_deletion_requests for select
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'platform_admin')
  );

-- Platform admins can update status
drop policy if exists "admin updates data deletion requests" on data_deletion_requests;
create policy "admin updates data deletion requests"
  on data_deletion_requests for update
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'platform_admin')
  );

-- ---------------------------------------------------------------------------
-- 9. Revoke direct execute grants (security)
-- ---------------------------------------------------------------------------
revoke all on function request_account_deletion(text) from anon;
revoke all on function cancel_account_deletion() from anon;
revoke all on function admin_execute_deletion(uuid) from anon;
revoke all on function get_deletion_request_status() from anon;
revoke all on function admin_list_pending_deletions() from anon;

grant execute on function request_account_deletion(text) to authenticated;
grant execute on function cancel_account_deletion() to authenticated;
grant execute on function get_deletion_request_status() to authenticated;
-- admin_execute_deletion and admin_list_pending_deletions: internal auth check only, no grant needed
