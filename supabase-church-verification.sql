-- Church verification system
-- Run AFTER supabase-production-rls.sql.
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE / idempotent DDL).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. verification_status enum
-- ─────────────────────────────────────────────────────────────────────────────
do $$ begin
  create type public.verification_status as enum (
    'unverified', 'pending', 'verified', 'rejected'
  );
exception when duplicate_object then null;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. church_verifications table
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.church_verifications (
  id                  uuid primary key default gen_random_uuid(),
  church_id           uuid not null references churches(id) on delete cascade,
  submitted_by        uuid not null references auth.users(id) on delete cascade,
  status              public.verification_status not null default 'pending',

  -- Contact info
  pastor_name         text,
  contact_email       text,
  contact_phone       text,
  address             text,

  -- Document URLs (stored in Supabase Storage, private bucket)
  registration_doc_url text,
  pastor_id_url        text,
  address_proof_url    text,

  -- Admin review
  reviewed_by         uuid references auth.users(id) on delete set null,
  reviewed_at         timestamptz,
  rejection_reason    text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (church_id)
);

-- Index for admin queries (filter by status)
create index if not exists church_verifications_status_idx
  on public.church_verifications (status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Add verified_at / verification_status shortcut to churches table
--    (denormalized for fast badge rendering — source of truth is church_verifications)
-- ─────────────────────────────────────────────────────────────────────────────
alter table churches
  add column if not exists verification_status public.verification_status
  not null default 'unverified';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Trigger: keep churches.verification_status in sync
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.sync_church_verification_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.churches
  set verification_status = new.status
  where id = new.church_id;
  return new;
end;
$$;

drop trigger if exists trg_sync_church_verification_status on public.church_verifications;
create trigger trg_sync_church_verification_status
after insert or update on public.church_verifications
for each row execute function public.sync_church_verification_status();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.church_verifications enable row level security;

drop policy if exists "church_verifications select admin or platform" on church_verifications;
drop policy if exists "church_verifications insert admin" on church_verifications;
drop policy if exists "church_verifications update platform admin" on church_verifications;

-- Church admins can see their own verification record
create policy "church_verifications select admin" on church_verifications
  for select to authenticated
  using (
    submitted_by = auth.uid()
    or exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'platform_admin'
    )
  );

-- Church admins can submit a verification request for their own church
create policy "church_verifications insert admin" on church_verifications
  for insert to authenticated
  with check (
    submitted_by = auth.uid()
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'church_admin'
        and profiles.church_id = church_verifications.church_id
    )
  );

-- Only platform admins can update (approve/reject)
create policy "church_verifications update platform admin" on church_verifications
  for update to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'platform_admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'platform_admin'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Platform admin review function (SECURITY DEFINER — bypasses RLS for
--    the notification insert which requires actor = auth.uid())
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.review_church_verification(
  p_church_id uuid,
  p_status public.verification_status,
  p_rejection_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_submitted_by uuid;
begin
  v_admin_id := auth.uid();

  -- Only platform admins
  if not exists (
    select 1 from public.profiles
    where id = v_admin_id and role = 'platform_admin'
  ) then
    raise exception 'Not authorized';
  end if;

  select submitted_by into v_submitted_by
  from public.church_verifications
  where church_id = p_church_id;

  update public.church_verifications
  set
    status           = p_status,
    reviewed_by      = v_admin_id,
    reviewed_at      = now(),
    rejection_reason = p_rejection_reason,
    updated_at       = now()
  where church_id = p_church_id;
  -- Note: trg_sync_church_verification_status fires here and sets
  -- churches.verification_status = p_status automatically.

  -- Also keep the extra canonical fields in sync on churches
  -- (the trigger only handles verification_status)
  update public.churches
  set
    location_verified            = (p_status = 'verified'),
    location_verified_at         = case when p_status = 'verified' then now() else null end,
    location_verification_status = case when p_status = 'verified' then 'approved' else 'rejected' end
  where id = p_church_id;

  -- Notify the church admin
  if v_submitted_by is not null then
    insert into public.notifications (
      recipient_user_id, actor_user_id, type, church_id, is_read
    )
    values (
      v_submitted_by,
      v_admin_id,
      case when p_status = 'verified' then 'church_verified' else 'church_rejected' end,
      p_church_id,
      false
    );
  end if;
end;
$$;

revoke all on function public.review_church_verification(uuid, public.verification_status, text) from public;
grant execute on function public.review_church_verification(uuid, public.verification_status, text) to authenticated;
