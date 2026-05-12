-- TheBride notification triggers
-- Review in Supabase SQL Editor before applying.
-- Creates automatic notifications for follows, post likes, comments, and replies.

create or replace function public.create_notification(
  p_recipient_user_id uuid,
  p_actor_user_id uuid,
  p_type text,
  p_post_id uuid default null,
  p_comment_id uuid default null
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
    is_read
  )
  values (
    p_recipient_user_id,
    p_actor_user_id,
    p_type,
    p_post_id,
    p_comment_id,
    false
  );
end;
$$;

create or replace function public.notify_on_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.create_notification(
    new.following_id,
    new.follower_id,
    'follow',
    null,
    null
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_on_follow on public.follows;
create trigger trg_notify_on_follow
after insert on public.follows
for each row execute function public.notify_on_follow();

create or replace function public.notify_on_post_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_owner uuid;
begin
  select user_id into v_post_owner
  from public.posts
  where id = new.post_id;

  perform public.create_notification(
    v_post_owner,
    new.user_id,
    'like',
    new.post_id,
    null
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_on_post_like on public.likes;
create trigger trg_notify_on_post_like
after insert on public.likes
for each row execute function public.notify_on_post_like();

create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_owner uuid;
  v_parent_owner uuid;
begin
  if new.parent_comment_id is null then
    select user_id into v_post_owner
    from public.posts
    where id = new.post_id;

    perform public.create_notification(
      v_post_owner,
      new.user_id,
      'comment',
      new.post_id,
      new.id
    );
  else
    select user_id into v_parent_owner
    from public.comments
    where id = new.parent_comment_id;

    perform public.create_notification(
      v_parent_owner,
      new.user_id,
      'reply',
      new.post_id,
      new.id
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_on_comment on public.comments;
create trigger trg_notify_on_comment
after insert on public.comments
for each row execute function public.notify_on_comment();

-- Realtime publication for notification badge/page updates.
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
