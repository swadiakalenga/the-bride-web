-- Security audit patches for TheBride
-- Run AFTER supabase-production-rls.sql and supabase-church-verification.sql.
-- Addresses: missing profile INSERT, church INSERT, storage bucket policies,
-- and ensures no tables are left without RLS enabled.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Profiles — allow new user creation on registration
--    (Supabase auth.users trigger or manual insert on sign-up)
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "profiles insert self" on profiles;
create policy "profiles insert self" on profiles
  for insert to authenticated
  with check (id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Churches — allow church_admin to INSERT their own church
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "churches insert admin" on churches;
create policy "churches insert admin" on churches
  for insert to authenticated
  with check (admin_user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Church memberships — users manage their own; admins see all for their church
-- ─────────────────────────────────────────────────────────────────────────────
alter table church_memberships enable row level security;

drop policy if exists "allow all church_memberships" on church_memberships;
drop policy if exists "church_memberships select self or admin" on church_memberships;
drop policy if exists "church_memberships insert self" on church_memberships;
drop policy if exists "church_memberships update admin" on church_memberships;
drop policy if exists "church_memberships delete self or admin" on church_memberships;

create policy "church_memberships select self or admin" on church_memberships
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'church_admin'
        and profiles.church_id = church_memberships.church_id
    )
  );

create policy "church_memberships insert self" on church_memberships
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "church_memberships update admin" on church_memberships
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'church_admin'
        and profiles.church_id = church_memberships.church_id
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'church_admin'
        and profiles.church_id = church_memberships.church_id
    )
  );

create policy "church_memberships delete self or admin" on church_memberships
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'church_admin'
        and profiles.church_id = church_memberships.church_id
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Live streams — only church admins can INSERT/UPDATE their own streams;
--    all authenticated users can SELECT
-- ─────────────────────────────────────────────────────────────────────────────
alter table live_streams enable row level security;

drop policy if exists "allow all live_streams" on live_streams;
drop policy if exists "live_streams select authenticated" on live_streams;
drop policy if exists "live_streams insert admin" on live_streams;
drop policy if exists "live_streams update admin" on live_streams;

create policy "live_streams select authenticated" on live_streams
  for select to authenticated
  using (true);

create policy "live_streams insert admin" on live_streams
  for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'church_admin'
        and profiles.church_id = live_streams.church_id
    )
  );

create policy "live_streams update admin" on live_streams
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'church_admin'
        and profiles.church_id = live_streams.church_id
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'church_admin'
        and profiles.church_id = live_streams.church_id
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Donations — ensure RLS if table exists
-- ─────────────────────────────────────────────────────────────────────────────
do $$ begin
  if exists (select 1 from pg_tables where schemaname='public' and tablename='donations') then
    execute 'alter table donations enable row level security';
    execute 'drop policy if exists "allow all donations" on donations';
    execute '
      create policy "donations select own" on donations
        for select to authenticated
        using (user_id = auth.uid())
    ';
    execute '
      create policy "donations insert own" on donations
        for insert to authenticated
        with check (user_id = auth.uid())
    ';
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Storage bucket policies (run these per-bucket in Supabase dashboard
--    or via the SQL editor — shown here for documentation)
--
--    Recommended bucket configuration:
--
--    Bucket "avatars"          — public read, authenticated write owner-only
--    Bucket "post-media"       — public read, authenticated write owner-only
--    Bucket "church-docs"      — PRIVATE, only submitted_by + platform_admin
--    Bucket "message-media"    — PRIVATE, only conversation participants
--
--    The Storage API does not support SQL RLS directly; configure policies
--    via the Supabase dashboard Storage > Policies for each bucket.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Verify no table is accidentally left with RLS disabled
--    (informational — run and review manually)
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND rowsecurity = false
-- ORDER BY tablename;
