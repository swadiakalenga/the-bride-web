-- TheBride production RLS draft
-- Review in Supabase before applying. This replaces broad development policies
-- with ownership-based rules for the core social tables.

-- Notifications: users can read/update only their own notifications.
alter table notifications enable row level security;
drop policy if exists "allow all notifications" on notifications;
drop policy if exists "notifications select own" on notifications;
drop policy if exists "notifications update own" on notifications;
drop policy if exists "notifications insert authenticated" on notifications;

create policy "notifications select own" on notifications
  for select to authenticated
  using (recipient_user_id = auth.uid());

create policy "notifications update own" on notifications
  for update to authenticated
  using (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());

create policy "notifications insert authenticated" on notifications
  for insert to authenticated
  with check (actor_user_id = auth.uid());

-- Posts: public authenticated reads, owner writes, church admins can create church posts only for their church.
alter table posts enable row level security;
drop policy if exists "allow all posts" on posts;
drop policy if exists "posts select authenticated" on posts;
drop policy if exists "posts insert owner" on posts;
drop policy if exists "posts update owner" on posts;
drop policy if exists "posts delete owner" on posts;

create policy "posts select authenticated" on posts
  for select to authenticated
  using (true);

create policy "posts insert owner" on posts
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      church_id is null
      or exists (
        select 1 from profiles
        where profiles.id = auth.uid()
          and profiles.role = 'church_admin'
          and profiles.church_id = posts.church_id
      )
    )
  );

create policy "posts update owner" on posts
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "posts delete owner" on posts
  for delete to authenticated
  using (user_id = auth.uid());

-- Comments: authenticated users can read, create as themselves, and modify their own comments.
alter table comments enable row level security;
drop policy if exists "allow all comments" on comments;
drop policy if exists "comments select authenticated" on comments;
drop policy if exists "comments insert owner" on comments;
drop policy if exists "comments update owner" on comments;
drop policy if exists "comments delete owner" on comments;

create policy "comments select authenticated" on comments
  for select to authenticated
  using (true);

create policy "comments insert owner" on comments
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "comments update owner" on comments
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "comments delete owner" on comments
  for delete to authenticated
  using (user_id = auth.uid());

-- Likes and comment likes: users manage only their own rows.
alter table likes enable row level security;
drop policy if exists "allow all likes" on likes;
drop policy if exists "likes select authenticated" on likes;
drop policy if exists "likes insert owner" on likes;
drop policy if exists "likes delete owner" on likes;

create policy "likes select authenticated" on likes
  for select to authenticated
  using (true);

create policy "likes insert owner" on likes
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "likes delete owner" on likes
  for delete to authenticated
  using (user_id = auth.uid());

alter table comment_likes enable row level security;
drop policy if exists "allow all comment likes" on comment_likes;
drop policy if exists "comment_likes select authenticated" on comment_likes;
drop policy if exists "comment_likes insert owner" on comment_likes;
drop policy if exists "comment_likes delete owner" on comment_likes;

create policy "comment_likes select authenticated" on comment_likes
  for select to authenticated
  using (true);

create policy "comment_likes insert owner" on comment_likes
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "comment_likes delete owner" on comment_likes
  for delete to authenticated
  using (user_id = auth.uid());

-- Follows and church follows: users manage only their own follow rows.
alter table follows enable row level security;
drop policy if exists "allow all follows" on follows;
drop policy if exists "follows select authenticated" on follows;
drop policy if exists "follows insert owner" on follows;
drop policy if exists "follows delete owner" on follows;

create policy "follows select authenticated" on follows
  for select to authenticated
  using (true);

create policy "follows insert owner" on follows
  for insert to authenticated
  with check (follower_id = auth.uid());

create policy "follows delete owner" on follows
  for delete to authenticated
  using (follower_id = auth.uid());

alter table church_follows enable row level security;
drop policy if exists "allow all church_follows" on church_follows;
drop policy if exists "church_follows select authenticated" on church_follows;
drop policy if exists "church_follows insert owner" on church_follows;
drop policy if exists "church_follows delete owner" on church_follows;

create policy "church_follows select authenticated" on church_follows
  for select to authenticated
  using (true);

create policy "church_follows insert owner" on church_follows
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "church_follows delete owner" on church_follows
  for delete to authenticated
  using (user_id = auth.uid());

-- Profiles and churches: public authenticated reads, self/profile admin writes.
alter table profiles enable row level security;
drop policy if exists "allow all profiles" on profiles;
drop policy if exists "profiles select authenticated" on profiles;
drop policy if exists "profiles update self" on profiles;

create policy "profiles select authenticated" on profiles
  for select to authenticated
  using (true);

create policy "profiles update self" on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

alter table churches enable row level security;
drop policy if exists "allow all churches" on churches;
drop policy if exists "churches select authenticated" on churches;
drop policy if exists "churches update admin" on churches;

create policy "churches select authenticated" on churches
  for select to authenticated
  using (true);

create policy "churches update admin" on churches
  for update to authenticated
  using (admin_user_id = auth.uid())
  with check (admin_user_id = auth.uid());

-- Private messaging: only conversation participants can read/send messages.
create or replace function public.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $
  select exists (
    select 1
    from public.conversation_participants
    where conversation_id = p_conversation_id
      and user_id = auth.uid()
  );
$;

alter table conversations enable row level security;
drop policy if exists "allow all conversations" on conversations;
drop policy if exists "conversations select participant" on conversations;
drop policy if exists "conversations insert authenticated" on conversations;

create policy "conversations select participant" on conversations
  for select to authenticated
  using (public.is_conversation_participant(id));

create policy "conversations insert authenticated" on conversations
  for insert to authenticated
  with check (true);

alter table conversation_participants enable row level security;
drop policy if exists "allow all conversation_participants" on conversation_participants;
drop policy if exists "conversation_participants select participant" on conversation_participants;
drop policy if exists "conversation_participants insert self or existing participant" on conversation_participants;

create policy "conversation_participants select participant" on conversation_participants
  for select to authenticated
  using (user_id = auth.uid() or public.is_conversation_participant(conversation_id));

create policy "conversation_participants insert self or existing participant" on conversation_participants
  for insert to authenticated
  with check (user_id = auth.uid() or public.is_conversation_participant(conversation_id));

alter table messages enable row level security;
drop policy if exists "allow all messages" on messages;
drop policy if exists "messages select participant" on messages;
drop policy if exists "messages insert participant sender" on messages;
drop policy if exists "messages update participant" on messages;

create policy "messages select participant" on messages
  for select to authenticated
  using (public.is_conversation_participant(conversation_id));

create policy "messages insert participant sender" on messages
  for insert to authenticated
  with check (sender_id = auth.uid() and public.is_conversation_participant(conversation_id));

create policy "messages update participant" on messages
  for update to authenticated
  using (public.is_conversation_participant(conversation_id))
  with check (public.is_conversation_participant(conversation_id));

alter table message_requests enable row level security;
drop policy if exists "allow all message_requests" on message_requests;
drop policy if exists "message_requests select sender recipient" on message_requests;
drop policy if exists "message_requests insert sender" on message_requests;
drop policy if exists "message_requests update sender recipient" on message_requests;

create policy "message_requests select sender recipient" on message_requests
  for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());

create policy "message_requests insert sender" on message_requests
  for insert to authenticated
  with check (sender_id = auth.uid());

create policy "message_requests update sender recipient" on message_requests
  for update to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid())
  with check (sender_id = auth.uid() or recipient_id = auth.uid());

-- Storage policies should ensure authenticated uploads and public reads for intended buckets only.
