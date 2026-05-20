-- Notification enhancements for church membership workflow
-- Run AFTER supabase-notification-triggers.sql.
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add church_id column to notifications
--    Populated when a notification is tied to a specific church
--    (membership_request, membership_approved, membership_rejected, event).
-- ─────────────────────────────────────────────────────────────────────────────
alter table notifications
  add column if not exists church_id uuid null
  references churches(id) on delete set null;

alter table notifications
  add column if not exists conversation_id uuid null
  references conversations(id) on delete set null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Update create_notification() to accept church_id and conversation_id
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.create_notification(
  p_recipient_user_id uuid,
  p_actor_user_id uuid,
  p_type text,
  p_post_id uuid default null,
  p_comment_id uuid default null,
  p_church_id uuid default null,
  p_conversation_id uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_recipient_user_id is null or p_actor_user_id is null then
    return;
  end if;

  if p_recipient_user_id = p_actor_user_id then
    return;
  end if;

  insert into public.notifications (
    recipient_user_id,
    actor_user_id,
    type,
    post_id,
    comment_id,
    church_id,
    conversation_id,
    is_read
  )
  values (
    p_recipient_user_id,
    p_actor_user_id,
    p_type,
    p_post_id,
    p_comment_id,
    p_church_id,
    p_conversation_id,
    false
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Auto-notify church admin when a membership request is submitted
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.notify_on_membership_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
begin
  -- Only fire on new pending requests
  if new.status <> 'pending' then
    return new;
  end if;

  -- Find the church admin
  select admin_user_id into v_admin_id
  from public.churches
  where id = new.church_id;

  perform public.create_notification(
    v_admin_id,
    new.user_id,
    'membership_request',
    null,
    null,
    new.church_id,
    null
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_on_membership_request on public.church_memberships;
create trigger trg_notify_on_membership_request
after insert on public.church_memberships
for each row execute function public.notify_on_membership_request();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Realtime: ensure notifications table is published (idempotent)
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end $$;
