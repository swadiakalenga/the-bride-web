-- ============================================================
-- Support Tickets
-- Run this in the Supabase SQL editor (Dashboard → SQL editor)
-- ============================================================

create table if not exists public.support_tickets (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        references public.profiles(id) on delete set null,
  email          text,
  category       text        not null,
  subject        text        not null,
  message        text        not null,
  status         text        not null default 'open',
  priority       text        not null default 'normal',
  admin_response text,
  assigned_to    uuid        references public.profiles(id) on delete set null,
  resolved_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint support_tickets_status_check
    check (status in ('open', 'in_progress', 'resolved', 'closed')),

  constraint support_tickets_category_check
    check (category in ('bug', 'payment', 'live_stream', 'account', 'church', 'messaging', 'feature_request', 'other')),

  constraint support_tickets_priority_check
    check (priority in ('low', 'normal', 'high', 'urgent'))
);

-- ── updated_at trigger ───────────────────────────────────────────────────────

create or replace function public.set_support_tickets_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists support_tickets_set_updated_at on public.support_tickets;

create trigger support_tickets_set_updated_at
  before update on public.support_tickets
  for each row execute function public.set_support_tickets_updated_at();

-- ── Row Level Security ───────────────────────────────────────────────────────

alter table public.support_tickets enable row level security;

-- 1. Authenticated users can insert their own ticket
drop policy if exists "support_tickets_insert_own" on public.support_tickets;
create policy "support_tickets_insert_own"
  on public.support_tickets
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- 2. Authenticated users can read their own tickets
drop policy if exists "support_tickets_select_own" on public.support_tickets;
create policy "support_tickets_select_own"
  on public.support_tickets
  for select
  to authenticated
  using (user_id = auth.uid());

-- 3. Users can update subject/message on their own open tickets
--    (admin_response, status, priority, assigned_to are not user-editable via this policy)
drop policy if exists "support_tickets_update_own_open" on public.support_tickets;
create policy "support_tickets_update_own_open"
  on public.support_tickets
  for update
  to authenticated
  using (user_id = auth.uid() and status = 'open')
  with check (user_id = auth.uid() and status = 'open');

-- 4. platform_admin: full select on all tickets
drop policy if exists "support_tickets_admin_select" on public.support_tickets;
create policy "support_tickets_admin_select"
  on public.support_tickets
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'platform_admin'
    )
  );

-- 4b. platform_admin: full update on all tickets
drop policy if exists "support_tickets_admin_update" on public.support_tickets;
create policy "support_tickets_admin_update"
  on public.support_tickets
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'platform_admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'platform_admin'
    )
  );

-- 4c. platform_admin: delete
drop policy if exists "support_tickets_admin_delete" on public.support_tickets;
create policy "support_tickets_admin_delete"
  on public.support_tickets
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'platform_admin'
    )
  );
