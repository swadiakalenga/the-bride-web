-- Platform payments & donations migration for TheBride
-- Run AFTER supabase-platform-admin.sql and supabase-security-audit.sql.
-- Safe to re-run (uses IF NOT EXISTS / CREATE OR REPLACE / idempotent DDL).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. payment_settings — centralised payment method configuration per owner
--    owner_type = 'platform' → owner_id is NULL (platform-wide)
--    owner_type = 'church'   → owner_id = churches.id
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.payment_settings (
  id           uuid primary key default gen_random_uuid(),
  owner_type   text not null check (owner_type in ('platform', 'church')),
  owner_id     uuid,
  method       text not null check (method in ('paypal', 'mobile_money', 'bank', 'stripe')),
  enabled      boolean not null default false,
  label        text,
  config       jsonb not null default '{}',
  instructions text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Uniqueness: one row per (owner, method). Two partial indexes because
-- PostgreSQL treats NULLs as distinct in regular UNIQUE constraints.
create unique index if not exists payment_settings_platform_unique
  on public.payment_settings (owner_type, method)
  where owner_id is null;

create unique index if not exists payment_settings_church_unique
  on public.payment_settings (owner_type, owner_id, method)
  where owner_id is not null;

create index if not exists payment_settings_owner_idx
  on public.payment_settings (owner_type, owner_id);

alter table public.payment_settings enable row level security;

drop policy if exists "paysettings read enabled"         on public.payment_settings;
drop policy if exists "paysettings read platform admin"  on public.payment_settings;
drop policy if exists "paysettings read church admin"    on public.payment_settings;
drop policy if exists "paysettings write platform"       on public.payment_settings;
drop policy if exists "paysettings write church"         on public.payment_settings;
drop policy if exists "paysettings update platform"      on public.payment_settings;
drop policy if exists "paysettings update church"        on public.payment_settings;
drop policy if exists "paysettings delete platform"      on public.payment_settings;
drop policy if exists "paysettings delete church"        on public.payment_settings;

-- Any authenticated user may read enabled settings (public-facing payment info)
create policy "paysettings read enabled" on public.payment_settings
  for select to authenticated
  using (enabled = true);

-- Platform admin may read ALL settings (including disabled)
create policy "paysettings read platform admin" on public.payment_settings
  for select to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin')
  );

-- Church admin may read ALL settings for their own church
create policy "paysettings read church admin" on public.payment_settings
  for select to authenticated
  using (
    owner_type = 'church'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'church_admin' and church_id = owner_id
    )
  );

create policy "paysettings write platform" on public.payment_settings
  for insert to authenticated
  with check (
    owner_type = 'platform'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin')
  );

create policy "paysettings write church" on public.payment_settings
  for insert to authenticated
  with check (
    owner_type = 'church'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'church_admin' and church_id = owner_id
    )
  );

create policy "paysettings update platform" on public.payment_settings
  for update to authenticated
  using (
    owner_type = 'platform'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin')
  );

create policy "paysettings update church" on public.payment_settings
  for update to authenticated
  using (
    owner_type = 'church'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'church_admin' and church_id = owner_id
    )
  );

create policy "paysettings delete platform" on public.payment_settings
  for delete to authenticated
  using (
    owner_type = 'platform'
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin')
  );

create policy "paysettings delete church" on public.payment_settings
  for delete to authenticated
  using (
    owner_type = 'church'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'church_admin' and church_id = owner_id
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. donations — unified donation records (platform + church)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.donations (
  id           uuid primary key default gen_random_uuid(),
  donor_id     uuid not null references auth.users(id) on delete cascade,
  target_type  text not null check (target_type in ('platform', 'church')),
  target_id    uuid,            -- null for platform donations
  give_type    text,            -- 'tithe' | 'offering' | 'donation' (church only)
  amount       numeric(12,2) not null check (amount > 0),
  currency     text not null default 'USD',
  method       text not null,
  status       text not null default 'pending'
               check (status in ('pending', 'confirmed', 'rejected')),
  reference    text,
  note         text,
  created_at   timestamptz not null default now(),
  reviewed_by  uuid references auth.users(id) on delete set null,
  reviewed_at  timestamptz
);

-- Safe ALTER TABLE for cases where the donations table already exists with the
-- old tithe-page schema (user_id, church_id, type, payment_reference).
alter table public.donations add column if not exists donor_id     uuid references auth.users(id) on delete cascade;
alter table public.donations add column if not exists target_type  text;
alter table public.donations add column if not exists target_id    uuid;
alter table public.donations add column if not exists give_type    text;
alter table public.donations add column if not exists method       text;
alter table public.donations add column if not exists status       text default 'pending';
alter table public.donations add column if not exists reference    text;
alter table public.donations add column if not exists reviewed_by  uuid references auth.users(id) on delete set null;
alter table public.donations add column if not exists reviewed_at  timestamptz;

create index if not exists donations_donor_idx  on public.donations (donor_id);
create index if not exists donations_target_idx on public.donations (target_type, target_id);
create index if not exists donations_status_idx on public.donations (status);

alter table public.donations enable row level security;

-- Drop old policies from security-audit.sql which used the old user_id column
drop policy if exists "donations select own"  on public.donations;
drop policy if exists "donations insert own"  on public.donations;
drop policy if exists "allow all donations"   on public.donations;

-- Fresh policies using new column names
drop policy if exists "donations read own"            on public.donations;
drop policy if exists "donations insert donor"        on public.donations;
drop policy if exists "donations read platform admin" on public.donations;
drop policy if exists "donations read church admin"   on public.donations;
drop policy if exists "donations update platform"     on public.donations;
drop policy if exists "donations update church"       on public.donations;

create policy "donations read own" on public.donations
  for select to authenticated
  using (donor_id = auth.uid());

create policy "donations insert donor" on public.donations
  for insert to authenticated
  with check (donor_id = auth.uid());

create policy "donations read platform admin" on public.donations
  for select to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin')
  );

create policy "donations read church admin" on public.donations
  for select to authenticated
  using (
    target_type = 'church'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'church_admin' and church_id = target_id
    )
  );

create policy "donations update platform" on public.donations
  for update to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin')
  );

create policy "donations update church" on public.donations
  for update to authenticated
  using (
    target_type = 'church'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'church_admin' and church_id = target_id
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. upsert_payment_setting() — atomic upsert for platform/church admins
--    Handles NULL owner_id (platform) vs non-NULL (church) correctly.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.upsert_payment_setting(
  p_owner_type   text,
  p_owner_id     uuid,
  p_method       text,
  p_enabled      boolean,
  p_label        text    default null,
  p_config       jsonb   default '{}',
  p_instructions text    default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_owner_type = 'platform' then
    if not exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin') then
      raise exception 'Not authorized';
    end if;
  elsif p_owner_type = 'church' then
    if not exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'church_admin' and church_id = p_owner_id
    ) then
      raise exception 'Not authorized';
    end if;
  else
    raise exception 'Invalid owner_type';
  end if;

  if p_method not in ('paypal', 'mobile_money', 'bank', 'stripe') then
    raise exception 'Invalid method';
  end if;

  -- Locate existing row (NULL-safe comparison)
  select id into v_id
  from public.payment_settings
  where owner_type = p_owner_type
    and method     = p_method
    and (
      (p_owner_id is null     and owner_id is null)
      or
      (p_owner_id is not null and owner_id = p_owner_id)
    );

  if v_id is null then
    insert into public.payment_settings
      (owner_type, owner_id, method, enabled, label, config, instructions)
    values
      (p_owner_type, p_owner_id, p_method, p_enabled, p_label, p_config, p_instructions)
    returning id into v_id;
  else
    update public.payment_settings
    set
      enabled      = p_enabled,
      label        = p_label,
      config       = p_config,
      instructions = p_instructions,
      updated_at   = now()
    where id = v_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.upsert_payment_setting(text, uuid, text, boolean, text, jsonb, text) from public;
grant execute on function public.upsert_payment_setting(text, uuid, text, boolean, text, jsonb, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. admin_list_all_donations() — paginated list for platform admin
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_list_all_donations(
  p_target_type text default 'all',
  p_status      text default 'all',
  p_limit       int  default 50,
  p_offset      int  default 0
)
returns table (
  id          uuid,
  donor_id    uuid,
  donor_name  text,
  target_type text,
  target_id   uuid,
  give_type   text,
  amount      numeric,
  currency    text,
  method      text,
  status      text,
  reference   text,
  note        text,
  created_at  timestamptz
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
    d.id,
    d.donor_id,
    p.full_name::text  as donor_name,
    d.target_type::text,
    d.target_id,
    d.give_type::text,
    d.amount,
    d.currency::text,
    d.method::text,
    d.status::text,
    d.reference::text,
    d.note::text,
    d.created_at
  from public.donations d
  left join public.profiles p on p.id = d.donor_id
  where
    (p_target_type = 'all' or d.target_type = p_target_type)
    and (p_status  = 'all' or d.status      = p_status)
  order by d.created_at desc
  limit  p_limit
  offset p_offset;
end;
$$;

revoke all on function public.admin_list_all_donations(text, text, int, int) from public;
grant execute on function public.admin_list_all_donations(text, text, int, int) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. admin_update_donation() — confirm or reject a donation record
--    Callable by platform_admin (any donation) or church_admin (own church only)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_update_donation(
  p_donation_id uuid,
  p_status      text,
  p_notes       text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_type text;
  v_target_id   uuid;
begin
  select target_type, target_id into v_target_type, v_target_id
  from public.donations where id = p_donation_id;

  if v_target_type is null then
    raise exception 'Donation not found';
  end if;

  if p_status not in ('confirmed', 'rejected') then
    raise exception 'Invalid status';
  end if;

  if public.is_platform_admin() then
    null; -- allowed
  elsif v_target_type = 'church' and exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'church_admin' and church_id = v_target_id
  ) then
    null; -- allowed
  else
    raise exception 'Not authorized';
  end if;

  update public.donations
  set
    status      = p_status,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    note        = coalesce(p_notes, note)
  where id = p_donation_id;
end;
$$;

revoke all on function public.admin_update_donation(uuid, text, text) from public;
grant execute on function public.admin_update_donation(uuid, text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. church_list_donations() — for church admin to see their church's donations
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.church_list_donations(
  p_church_id uuid,
  p_status    text default 'all',
  p_limit     int  default 50,
  p_offset    int  default 0
)
returns table (
  id         uuid,
  donor_id   uuid,
  donor_name text,
  give_type  text,
  amount     numeric,
  currency   text,
  method     text,
  status     text,
  reference  text,
  note       text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'church_admin' and church_id = p_church_id
  ) and not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  return query
  select
    d.id,
    d.donor_id,
    p.full_name::text as donor_name,
    d.give_type::text,
    d.amount,
    d.currency::text,
    d.method::text,
    d.status::text,
    d.reference::text,
    d.note::text,
    d.created_at
  from public.donations d
  left join public.profiles p on p.id = d.donor_id
  where d.target_type = 'church'
    and d.target_id   = p_church_id
    and (p_status = 'all' or d.status = p_status)
  order by d.created_at desc
  limit  p_limit
  offset p_offset;
end;
$$;

revoke all on function public.church_list_donations(uuid, text, int, int) from public;
grant execute on function public.church_list_donations(uuid, text, int, int) to authenticated;
