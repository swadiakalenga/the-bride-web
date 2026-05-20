-- ─────────────────────────────────────────────────────────────────────────────
-- TheBride – Performance indexes
-- Run once in the Supabase SQL editor (safe to re-run; all are IF NOT EXISTS).
-- ─────────────────────────────────────────────────────────────────────────────

-- posts: feed queries (people + church)
create index if not exists idx_posts_created_at
  on public.posts (created_at desc);

create index if not exists idx_posts_user_created
  on public.posts (user_id, created_at desc);

create index if not exists idx_posts_church_created
  on public.posts (church_id, created_at desc)
  where church_id is not null;

-- likes
create index if not exists idx_likes_post_id
  on public.likes (post_id);

create index if not exists idx_likes_user_id
  on public.likes (user_id);

-- comments
create index if not exists idx_comments_post_created
  on public.comments (post_id, created_at asc);

create index if not exists idx_comments_parent
  on public.comments (parent_comment_id)
  where parent_comment_id is not null;

-- post_shares
create index if not exists idx_post_shares_post_id
  on public.post_shares (post_id);

create index if not exists idx_post_shares_user_created
  on public.post_shares (user_id, created_at desc);

-- follows
create index if not exists idx_follows_follower
  on public.follows (follower_id);

create index if not exists idx_follows_following
  on public.follows (following_id);

-- messages
create index if not exists idx_messages_conv_created
  on public.messages (conversation_id, created_at desc);

create index if not exists idx_messages_unread
  on public.messages (conversation_id, is_read, sender_id)
  where is_read = false;

-- conversation_participants
create index if not exists idx_conv_participants_user
  on public.conversation_participants (user_id);

create index if not exists idx_conv_participants_conv
  on public.conversation_participants (conversation_id);

-- notifications
create index if not exists idx_notifications_user_unread
  on public.notifications (recipient_user_id, created_at desc)
  where is_read = false;

create index if not exists idx_notifications_user_created
  on public.notifications (recipient_user_id, created_at desc);

-- church_memberships
create index if not exists idx_church_memberships_church_user
  on public.church_memberships (church_id, user_id);

create index if not exists idx_church_memberships_user
  on public.church_memberships (user_id);

-- reports
create index if not exists idx_reports_status_created
  on public.reports (status, created_at desc);

-- post_views
create index if not exists idx_post_views_post_id
  on public.post_views (post_id);

-- message_requests
create index if not exists idx_message_requests_recipient
  on public.message_requests (recipient_id, status, created_at desc);

create index if not exists idx_message_requests_sender
  on public.message_requests (sender_id, status, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Maintenance hint: run ANALYZE after applying indexes in production
-- ANALYZE public.posts, public.likes, public.comments, public.messages;
-- ─────────────────────────────────────────────────────────────────────────────
