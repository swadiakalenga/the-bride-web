-- ─────────────────────────────────────────────────────────────────────────────
-- TheBride – Performance RPCs
-- Run once in the Supabase SQL editor (safe to re-run; functions are replaced).
-- These replace N+1 query loops with single round-trips.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. get_conversation_list ────────────────────────────────────────────────
-- Replaces the per-conversation loop in messages/page.tsx and
-- the sidebar loop in messages/[id]/page.tsx.
-- Before: 2 queries × N conversations (last message + unread count each).
-- After: 1 query regardless of conversation count.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.get_conversation_list(p_user_id uuid)
returns table (
  conversation_id  uuid,
  other_user_id    uuid,
  other_user_name  text,
  other_user_avatar text,
  last_message_content text,
  last_message_at  timestamptz,
  last_sender_id   uuid,
  unread_count     bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with my_convs as (
    select cp.conversation_id
    from   conversation_participants cp
    where  cp.user_id = p_user_id
  ),
  other_parts as (
    select cp.conversation_id, cp.user_id
    from   conversation_participants cp
    join   my_convs mc on mc.conversation_id = cp.conversation_id
    where  cp.user_id <> p_user_id
  ),
  last_msgs as (
    select distinct on (m.conversation_id)
           m.conversation_id,
           m.content,
           m.created_at,
           m.sender_id
    from   messages m
    join   my_convs mc on mc.conversation_id = m.conversation_id
    order  by m.conversation_id, m.created_at desc
  ),
  unread as (
    select m.conversation_id, count(*) as cnt
    from   messages m
    join   my_convs mc on mc.conversation_id = m.conversation_id
    where  m.is_read = false
      and  m.sender_id <> p_user_id
    group  by m.conversation_id
  )
  select
    op.conversation_id,
    op.user_id                    as other_user_id,
    p.full_name::text             as other_user_name,
    p.avatar_url::text            as other_user_avatar,
    lm.content::text              as last_message_content,
    lm.created_at                 as last_message_at,
    lm.sender_id                  as last_sender_id,
    coalesce(u.cnt, 0)            as unread_count
  from   other_parts op
  left   join profiles  p  on p.id  = op.user_id
  left   join last_msgs lm on lm.conversation_id = op.conversation_id
  left   join unread    u  on u.conversation_id  = op.conversation_id
  order  by lm.created_at desc nulls last;
$$;

grant execute on function public.get_conversation_list(uuid) to authenticated;

-- ─── 2. get_post_stats_batch ─────────────────────────────────────────────────
-- Returns like/share/comment counts + current-user flags for a batch of posts.
-- Replaces 3 separate queries (loadLikes, loadShares, loadComments counts) with
-- a single round-trip.  The client keeps using the existing functions for
-- comment *content*; this RPC is only for the aggregate numbers.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.get_post_stats_batch(
  p_post_ids uuid[],
  p_user_id  uuid
)
returns table (
  post_id       uuid,
  like_count    bigint,
  user_liked    boolean,
  share_count   bigint,
  user_shared   boolean,
  comment_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with lc as (
    select l.post_id,
           count(*)                        as cnt,
           bool_or(l.user_id = p_user_id) as ul
    from   likes l
    where  l.post_id = any(p_post_ids)
    group  by l.post_id
  ),
  sc as (
    select ps.post_id,
           count(*)                         as cnt,
           bool_or(ps.user_id = p_user_id) as us
    from   post_shares ps
    where  ps.post_id = any(p_post_ids)
    group  by ps.post_id
  ),
  cc as (
    select c.post_id, count(*) as cnt
    from   comments c
    where  c.post_id = any(p_post_ids)
    group  by c.post_id
  )
  select
    t.pid                        as post_id,
    coalesce(lc.cnt,  0)         as like_count,
    coalesce(lc.ul,   false)     as user_liked,
    coalesce(sc.cnt,  0)         as share_count,
    coalesce(sc.us,   false)     as user_shared,
    coalesce(cc.cnt,  0)         as comment_count
  from   unnest(p_post_ids) as t(pid)
  left   join lc on lc.post_id = t.pid
  left   join sc on sc.post_id = t.pid
  left   join cc on cc.post_id = t.pid;
$$;

grant execute on function public.get_post_stats_batch(uuid[], uuid) to authenticated;

-- ─── 3. get_people_feed_page ─────────────────────────────────────────────────
-- Returns a unified people feed page: own posts + followed-user posts +
-- shares by followed users.  A single RPC replaces 3+ client queries.
-- Results are sorted by recency and paginated via limit/offset.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.get_people_feed_page(
  p_user_id  uuid,
  p_limit    int  default 15,
  p_offset   int  default 0
)
returns table (
  post_id        uuid,
  user_id        uuid,
  church_id      uuid,
  content        text,
  media_urls     text[],
  media_type     text,
  author_name    text,
  tagged_user_ids uuid[],
  created_at     timestamptz,
  updated_at     timestamptz,
  shared_by_user_id uuid,
  shared_at      timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  with following as (
    select following_id
    from   follows
    where  follower_id = p_user_id
  ),
  allowed as (
    select following_id as uid from following
    union all
    select p_user_id
  ),
  own_posts as (
    select
      p.id            as post_id,
      p.user_id,
      p.church_id,
      p.content,
      p.media_urls,
      p.media_type,
      p.author_name,
      p.tagged_user_ids,
      p.created_at,
      p.updated_at,
      null::uuid      as shared_by_user_id,
      null::timestamptz as shared_at
    from   posts p
    join   allowed a on a.uid = p.user_id
    where  p.church_id is null
  ),
  shared_posts as (
    select
      p.id            as post_id,
      p.user_id,
      p.church_id,
      p.content,
      p.media_urls,
      p.media_type,
      p.author_name,
      p.tagged_user_ids,
      p.created_at,
      p.updated_at,
      ps.user_id      as shared_by_user_id,
      ps.created_at   as shared_at
    from   post_shares ps
    join   following f  on f.following_id = ps.user_id
    join   posts     p  on p.id = ps.post_id
    where  p.church_id is null
      -- do not show a share if the original post is already in the own_posts CTE
      and  p.user_id not in (select uid from allowed)
  ),
  combined as (
    select * from own_posts
    union
    select * from shared_posts
  )
  select *
  from   combined
  order  by coalesce(shared_at, created_at) desc
  limit  p_limit
  offset p_offset;
$$;

grant execute on function public.get_people_feed_page(uuid, int, int) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Security notes:
--   • All three functions use SECURITY INVOKER (default) so they respect the
--     caller's RLS policies.  No data leakage risk.
--   • get_people_feed_page uses church_id IS NULL to exclude church posts,
--     consistent with the client-side people-feed filter.
--   • Indexes in supabase-performance-indexes.sql cover the hot paths.
-- ─────────────────────────────────────────────────────────────────────────────
