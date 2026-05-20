-- ─────────────────────────────────────────────────────────────────────────────
-- supabase-shares.sql
-- Creates the post_shares table for the share / repost feature.
--
-- RLS rules:
--   SELECT  — any authenticated user can see share counts
--   INSERT  — own row only; block-aware (cannot share from a blocked user)
--   DELETE  — own row only (un-share)
--
-- Idempotent — safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Create table
create table if not exists public.post_shares (
  id         uuid        primary key default gen_random_uuid(),
  post_id    uuid        not null references public.posts(id)    on delete cascade,
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  comment    text,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

-- 2. Row-level security
alter table public.post_shares enable row level security;

-- 3. Policies — recreated on every run so they are always current
drop policy if exists "post_shares_read"   on public.post_shares;
drop policy if exists "post_shares_insert" on public.post_shares;
drop policy if exists "post_shares_delete" on public.post_shares;

-- Any authenticated user can read all shares (needed for share counts)
create policy "post_shares_read"
  on public.post_shares
  for select
  using (auth.role() = 'authenticated');

-- Block-aware insert: cannot share a post if a block exists in either direction
create policy "post_shares_insert"
  on public.post_shares
  for insert
  with check (
    auth.uid() = user_id
    and not exists (
      select 1
        from public.user_blocks
       where (blocker_id = auth.uid()
              and blocked_id = (select user_id from public.posts where id = post_id limit 1))
          or (blocked_id  = auth.uid()
              and blocker_id = (select user_id from public.posts where id = post_id limit 1))
    )
  );

-- Users can remove only their own shares
create policy "post_shares_delete"
  on public.post_shares
  for delete
  using (auth.uid() = user_id);

-- 4. Indexes for profile feed and count queries
create index if not exists idx_post_shares_user_created
  on public.post_shares (user_id, created_at desc);

create index if not exists idx_post_shares_post_id
  on public.post_shares (post_id);

-- 5. Grant DML to authenticated role (RLS is the real guard)
grant select, insert, delete on public.post_shares to authenticated;
