-- ============================================================
-- TheBride - Complete Database Migration
-- Run this ENTIRE script in your Supabase SQL Editor
-- ============================================================

-- 1. Notifications: add conversation_id column
alter table notifications add column if not exists conversation_id uuid references conversations(id) on delete cascade;

-- 2. Notifications: update type constraint for new notification types
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('follow','like','comment','reply','membership_request','message','message_request','tag','prayer','event'));

-- 3. Live streams: add recording_url column
alter table live_streams add column if not exists recording_url text;

-- 4. Churches: add contact info columns
alter table churches add column if not exists email text;
alter table churches add column if not exists phone text;

-- 5. Profiles: add relationship status and gender
alter table profiles add column if not exists relationship_status text;
alter table profiles add column if not exists show_relationship_status boolean default false;
alter table profiles add column if not exists gender text;
alter table profiles add column if not exists show_gender boolean default false;

-- 6. Messages: add media support
alter table messages add column if not exists media_url text;
alter table messages add column if not exists media_type text; -- 'image', 'video', 'audio'

-- 7. Posts: add tagged_users support
alter table posts add column if not exists tagged_user_ids uuid[] default '{}';

-- 7b. Posts: fix media_type constraint to include 'audio'
alter table posts drop constraint if exists posts_media_type_check;
alter table posts add constraint posts_media_type_check
  check (media_type in ('photo', 'video', 'audio') or media_type is null);

-- 8. Post views table (create if not exists)
create table if not exists post_views (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(post_id, user_id)
);

-- 9. Church events table
create table if not exists church_events (
  id uuid primary key default gen_random_uuid(),
  church_id uuid references churches(id) on delete cascade not null,
  title text not null,
  description text,
  event_date timestamptz not null,
  location text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- 9b. Event RSVPs
create table if not exists event_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references church_events(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  status text not null check (status in ('going', 'interested', 'not_going')),
  created_at timestamptz default now(),
  unique(event_id, user_id)
);
create index if not exists idx_event_rsvps_event_id on event_rsvps(event_id);
create index if not exists idx_event_rsvps_user_id on event_rsvps(user_id);

-- 10. Prayer wall table
create table if not exists prayer_requests (
  id uuid primary key default gen_random_uuid(),
  church_id uuid references churches(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null,
  is_anonymous boolean default false,
  prayer_count int default 0,
  created_at timestamptz default now()
);

-- 11. Prayer support tracking
create table if not exists prayer_supports (
  id uuid primary key default gen_random_uuid(),
  prayer_request_id uuid references prayer_requests(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(prayer_request_id, user_id)
);

-- 12. Daily devotionals
create table if not exists devotionals (
  id uuid primary key default gen_random_uuid(),
  church_id uuid references churches(id) on delete cascade not null,
  title text not null,
  content text not null,
  bible_verse text,
  created_by uuid references auth.users(id) on delete set null,
  publish_date date default current_date,
  created_at timestamptz default now()
);

-- ============================================================
-- RLS Policies - Enable Row Level Security
-- ============================================================

-- Comment likes
alter table comment_likes enable row level security;
drop policy if exists "allow all comment likes" on comment_likes;
create policy "allow all comment likes" on comment_likes
  for all to authenticated using (true) with check (true);

-- Live streams
alter table live_streams enable row level security;
drop policy if exists "allow all live_streams" on live_streams;
create policy "allow all live_streams" on live_streams
  for all to authenticated using (true) with check (true);

-- Conversation participants
alter table conversation_participants enable row level security;
drop policy if exists "allow all conversation_participants" on conversation_participants;
create policy "allow all conversation_participants" on conversation_participants
  for all to authenticated using (true) with check (true);

-- Messages
alter table messages enable row level security;
drop policy if exists "allow all messages" on messages;
create policy "allow all messages" on messages
  for all to authenticated using (true) with check (true);

-- Conversations
alter table conversations enable row level security;
drop policy if exists "allow all conversations" on conversations;
create policy "allow all conversations" on conversations
  for all to authenticated using (true) with check (true);

-- Post views
alter table post_views enable row level security;
drop policy if exists "allow all post_views" on post_views;
create policy "allow all post_views" on post_views
  for all to authenticated using (true) with check (true);

-- Notifications
alter table notifications enable row level security;
drop policy if exists "allow all notifications" on notifications;
create policy "allow all notifications" on notifications
  for all to authenticated using (true) with check (true);

-- Church events
alter table church_events enable row level security;
drop policy if exists "allow all church_events" on church_events;
create policy "allow all church_events" on church_events
  for all to authenticated using (true) with check (true);

-- Event RSVPs
alter table event_rsvps enable row level security;
drop policy if exists "allow all event_rsvps" on event_rsvps;
create policy "allow all event_rsvps" on event_rsvps
  for all to authenticated using (true) with check (true);

-- Prayer requests
alter table prayer_requests enable row level security;
drop policy if exists "allow all prayer_requests" on prayer_requests;
create policy "allow all prayer_requests" on prayer_requests
  for all to authenticated using (true) with check (true);

-- Prayer supports
alter table prayer_supports enable row level security;
drop policy if exists "allow all prayer_supports" on prayer_supports;
create policy "allow all prayer_supports" on prayer_supports
  for all to authenticated using (true) with check (true);

-- Devotionals
alter table devotionals enable row level security;
drop policy if exists "allow all devotionals" on devotionals;
create policy "allow all devotionals" on devotionals
  for all to authenticated using (true) with check (true);

-- Message requests
alter table message_requests enable row level security;
drop policy if exists "allow all message_requests" on message_requests;
create policy "allow all message_requests" on message_requests
  for all to authenticated using (true) with check (true);

-- Posts
alter table posts enable row level security;
drop policy if exists "allow all posts" on posts;
create policy "allow all posts" on posts
  for all to authenticated using (true) with check (true);

-- Comments
alter table comments enable row level security;
drop policy if exists "allow all comments" on comments;
create policy "allow all comments" on comments
  for all to authenticated using (true) with check (true);

-- Likes
alter table likes enable row level security;
drop policy if exists "allow all likes" on likes;
create policy "allow all likes" on likes
  for all to authenticated using (true) with check (true);

-- Follows
alter table follows enable row level security;
drop policy if exists "allow all follows" on follows;
create policy "allow all follows" on follows
  for all to authenticated using (true) with check (true);

-- Profiles
alter table profiles enable row level security;
drop policy if exists "allow all profiles" on profiles;
create policy "allow all profiles" on profiles
  for all to authenticated using (true) with check (true);

-- Churches
alter table churches enable row level security;
drop policy if exists "allow all churches" on churches;
create policy "allow all churches" on churches
  for all to authenticated using (true) with check (true);

-- Church follows
alter table church_follows enable row level security;
drop policy if exists "allow all church_follows" on church_follows;
create policy "allow all church_follows" on church_follows
  for all to authenticated using (true) with check (true);

-- Church memberships
alter table church_memberships enable row level security;
drop policy if exists "allow all church_memberships" on church_memberships;
create policy "allow all church_memberships" on church_memberships
  for all to authenticated using (true) with check (true);

-- ============================================================
-- Storage bucket for media (if not exists)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload to media bucket
drop policy if exists "allow authenticated uploads" on storage.objects;
create policy "allow authenticated uploads" on storage.objects
  for insert to authenticated with check (bucket_id = 'media');

drop policy if exists "allow public reads" on storage.objects;
create policy "allow public reads" on storage.objects
  for select to public using (bucket_id = 'media');

-- ============================================================
-- Done! All tables and policies are set up.
-- ============================================================
