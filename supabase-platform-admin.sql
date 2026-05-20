-- Platform admin migration for TheBride
-- Run AFTER supabase-church-verification.sql and supabase-security-audit.sql.
-- Safe to re-run (uses IF NOT EXISTS / CREATE OR REPLACE / idempotent DDL).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Make sure 'platform_admin' is a valid role value (no enum — role is text)
--    To grant yourself platform_admin, run:
--      UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || '{"role":"platform_admin"}' WHERE email = 'your@email.com';
--      UPDATE public.profiles SET role = 'platform_admin' WHERE id = '<your-uuid>';
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Reports table
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references auth.users(id) on delete cascade,
  target_type  text not null check (target_type in ('post','comment','user','church','message')),
  target_id    uuid not null,
  reason       text not null,
  status       text not null default 'pending'
               check (status in ('pending','reviewed','resolved','dismissed')),
  reviewed_by  uuid references auth.users(id) on delete set null,
  reviewed_at  timestamptz,
  notes        text,
  created_at   timestamptz not null default now()
);

create index if not exists reports_status_idx    on public.reports (status);
create index if not exists reports_reporter_idx  on public.reports (reporter_id);

alter table public.reports enable row level security;

drop policy if exists "reports insert self"          on reports;
drop policy if exists "reports select self or admin" on reports;
drop policy if exists "reports update admin"         on reports;

create policy "reports insert self" on reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

create policy "reports select self or admin" on reports
  for select to authenticated
  using (
    reporter_id = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin')
  );

create policy "reports update admin" on reports
  for update to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Helper: is_platform_admin() — used inside all admin RPCs
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'platform_admin'
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. admin_get_stats() — overview numbers
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_get_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_result jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  select jsonb_build_object(
    'total_users',             (select count(*) from public.profiles),
    'total_churches',          (select count(*) from public.churches),
    'pending_verifications',   (select count(*) from public.church_verifications where status = 'pending'),
    'total_posts',             (select count(*) from public.posts),
    'total_messages',          (select count(*) from public.messages),
    'pending_reports',         (select count(*) from public.reports where status = 'pending'),
    'total_reports',           (select count(*) from public.reports)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_get_stats() from public;
grant execute on function public.admin_get_stats() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. admin_list_users() — accesses auth.users for email; SECURITY DEFINER
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_list_users(
  p_search text default null,
  p_limit  int  default 50,
  p_offset int  default 0
)
returns table (
  id           uuid,
  full_name    text,
  role         text,
  account_type text,
  church_id    uuid,
  city         text,
  country      text,
  created_at   timestamptz,
  email        text
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  return query
  select
    p.id,
    p.full_name,
    p.role,
    p.account_type,
    p.church_id,
    p.city,
    p.country,
    u.created_at,
    u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where (
    p_search is null
    or p.full_name ilike '%' || p_search || '%'
    or u.email    ilike '%' || p_search || '%'
  )
  order by u.created_at desc
  limit  p_limit
  offset p_offset;
end;
$$;

revoke all on function public.admin_list_users(text, int, int) from public;
grant execute on function public.admin_list_users(text, int, int) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. admin_list_churches()
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_list_churches(
  p_limit  int default 50,
  p_offset int default 0
)
returns table (
  id                  uuid,
  name                text,
  city                text,
  country             text,
  pastor_name         text,
  admin_user_id       uuid,
  admin_name          text,
  verification_status text,
  created_at          timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  return query
  select
    c.id,
    c.name,
    c.city,
    c.country,
    c.pastor_name,
    c.admin_user_id,
    p.full_name        as admin_name,
    c.verification_status::text,
    c.created_at
  from public.churches c
  left join public.profiles p on p.id = c.admin_user_id
  order by c.created_at desc
  limit  p_limit
  offset p_offset;
end;
$$;

revoke all on function public.admin_list_churches(int, int) from public;
grant execute on function public.admin_list_churches(int, int) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. admin_list_posts() — for moderation
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_list_posts(
  p_limit  int default 50,
  p_offset int default 0
)
returns table (
  id            uuid,
  content       text,
  user_id       uuid,
  author_name   text,
  church_id     uuid,
  media_urls    text[],
  created_at    timestamptz,
  like_count    bigint,
  comment_count bigint,
  report_count  bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  return query
  select
    po.id,
    po.content,
    po.user_id,
    pr.full_name                                                         as author_name,
    po.church_id,
    po.media_urls,
    po.created_at,
    coalesce((select count(*) from public.likes    where post_id = po.id), 0) as like_count,
    coalesce((select count(*) from public.comments where post_id = po.id), 0) as comment_count,
    coalesce((select count(*) from public.reports  where target_id = po.id and target_type = 'post'), 0) as report_count
  from public.posts po
  left join public.profiles pr on pr.id = po.user_id
  order by po.created_at desc
  limit  p_limit
  offset p_offset;
end;
$$;

revoke all on function public.admin_list_posts(int, int) from public;
grant execute on function public.admin_list_posts(int, int) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. admin_delete_post()
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_delete_post(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  delete from public.posts where id = p_post_id;
end;
$$;

revoke all on function public.admin_delete_post(uuid) from public;
grant execute on function public.admin_delete_post(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. admin_list_reports()
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_list_reports(
  p_status text default 'pending',
  p_limit  int  default 50
)
returns table (
  id            uuid,
  reporter_id   uuid,
  reporter_name text,
  target_type   text,
  target_id     uuid,
  reason        text,
  status        text,
  created_at    timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  return query
  select
    r.id,
    r.reporter_id,
    p.full_name as reporter_name,
    r.target_type,
    r.target_id,
    r.reason,
    r.status,
    r.created_at
  from public.reports r
  left join public.profiles p on p.id = r.reporter_id
  where (p_status = 'all' or r.status = p_status)
  order by r.created_at desc
  limit p_limit;
end;
$$;

revoke all on function public.admin_list_reports(text, int) from public;
grant execute on function public.admin_list_reports(text, int) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. admin_update_report()
-- ─────────────────────────────────────────────────────────────────────────────
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
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  if p_status not in ('reviewed','resolved','dismissed') then
    raise exception 'Invalid status value';
  end if;

  update public.reports
  set
    status      = p_status,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    notes       = p_notes
  where id = p_report_id;
end;
$$;

revoke all on function public.admin_update_report(uuid, text, text) from public;
grant execute on function public.admin_update_report(uuid, text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. admin_set_user_role()
--     Restricted: only 'member' and 'church_admin' are settable via this fn.
--     Granting platform_admin must be done directly in the DB.
-- ─────────────────────────────────────────────────────────────────────────────
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
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;
  if p_role not in ('member','church_admin') then
    raise exception 'Granting platform_admin must be done directly in the database';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Cannot change your own role through this function';
  end if;

  update public.profiles set role = p_role where id = p_user_id;
end;
$$;

revoke all on function public.admin_set_user_role(uuid, text) from public;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. Ensure reports is published to realtime (optional, for live admin badge)
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'reports'
  ) then
    execute 'alter publication supabase_realtime add table public.reports';
  end if;
end $$;
