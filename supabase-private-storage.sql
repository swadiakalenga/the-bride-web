-- =============================================================================
-- TheBride Private Storage Policies
-- Version: 2026-05-20
-- Manages private bucket policies for church documents and moderation evidence.
-- Run AFTER supabase-security-hardening.sql.
-- Safe to re-run (CREATE OR REPLACE / CREATE TABLE IF NOT EXISTS / idempotent).
-- =============================================================================
--
-- OVERVIEW
-- ─────────────────────────────────────────────────────────────────────────────
-- Two private buckets are required:
--
--   church-documents   — stores registration docs, pastor IDs, address proofs
--                        uploaded during church verification.
--                        Accessible to: platform_admin (any doc),
--                                       church_admin (their church only).
--
--   moderation-evidence — stores screenshots, exported chat logs, and other
--                         evidence captured during moderation reviews.
--                         Accessible to: platform_admin only.
--
-- BUCKET CREATION
-- ─────────────────────────────────────────────────────────────────────────────
-- Buckets MUST be created via the Supabase Dashboard or Management API before
-- these policies take effect. SQL cannot create Storage buckets.
--
--   Dashboard path: Storage → New Bucket
--     Name:   church-documents       public: OFF (private)
--     Name:   moderation-evidence    public: OFF (private)
--
-- Alternatively, via the Supabase Management API:
--   POST /storage/v1/bucket
--   { "id": "church-documents", "name": "church-documents", "public": false }
--   { "id": "moderation-evidence", "name": "moderation-evidence", "public": false }
--
-- APPLYING STORAGE RLS POLICIES
-- ─────────────────────────────────────────────────────────────────────────────
-- Storage RLS policies live in the storage schema and are applied via
-- Dashboard → Storage → Policies, or via SQL against storage.objects.
-- The SQL blocks below apply them directly and are idempotent.
-- =============================================================================

-- =============================================================================
-- SECTION 1: BUCKET — church-documents
-- File path convention: <church_id_uuid>/<filename>
-- e.g. "a1b2c3d4-e5f6-...../registration.pdf"
-- =============================================================================

-- ─── SELECT: platform_admin reads any document ───────────────────────────────
drop policy if exists "admin read church documents" on storage.objects;
create policy "admin read church documents"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'church-documents'
    and (
      select role from public.profiles where id = auth.uid()
    ) = 'platform_admin'
  );

-- ─── SELECT: church_admin reads documents in their own church folder ──────────
drop policy if exists "church admin read own docs" on storage.objects;
create policy "church admin read own docs"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'church-documents'
    and (
      select role from public.profiles where id = auth.uid()
    ) = 'church_admin'
    -- The first path component must match the caller's church_id.
    -- storage.foldername(name) returns an array: ['<church_id>', '<subfolder>', ...]
    and (storage.foldername(name))[1] = (
      select church_id::text from public.profiles where id = auth.uid()
    )
  );

-- ─── INSERT: church_admin uploads to their own church folder only ─────────────
drop policy if exists "church admin upload own docs" on storage.objects;
create policy "church admin upload own docs"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'church-documents'
    and (
      select role from public.profiles where id = auth.uid()
    ) = 'church_admin'
    -- Ensure the file goes into the correct church_id subdirectory.
    -- This prevents a church admin from uploading to another church's folder.
    and (storage.foldername(name))[1] = (
      select church_id::text from public.profiles where id = auth.uid()
    )
    -- Block suspended church admins from uploading documents.
    and not coalesce(
      (select suspended from public.profiles where id = auth.uid()),
      false
    )
  );

-- ─── UPDATE: church_admin can replace their own docs; platform_admin can too ──
drop policy if exists "church admin update own docs"    on storage.objects;
drop policy if exists "platform admin update church docs" on storage.objects;

create policy "church admin update own docs" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'church-documents'
    and (select role from public.profiles where id = auth.uid()) = 'church_admin'
    and (storage.foldername(name))[1] = (
      select church_id::text from public.profiles where id = auth.uid()
    )
  )
  with check (
    bucket_id = 'church-documents'
    and (select role from public.profiles where id = auth.uid()) = 'church_admin'
    and (storage.foldername(name))[1] = (
      select church_id::text from public.profiles where id = auth.uid()
    )
  );

create policy "platform admin update church docs" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'church-documents'
    and (select role from public.profiles where id = auth.uid()) = 'platform_admin'
  )
  with check (
    bucket_id = 'church-documents'
    and (select role from public.profiles where id = auth.uid()) = 'platform_admin'
  );

-- ─── DELETE: only platform_admin may delete church documents ─────────────────
-- Church admins cannot delete docs they submitted (prevents evidence tampering
-- once a verification request is under review).
drop policy if exists "platform admin delete church docs" on storage.objects;
create policy "platform admin delete church docs" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'church-documents'
    and (select role from public.profiles where id = auth.uid()) = 'platform_admin'
  );

-- ─── NO anon policy — this entire bucket is inaccessible to anonymous callers.

-- =============================================================================
-- SECTION 2: BUCKET — moderation-evidence
-- File path convention: <report_id_or_action_id>/<filename>
-- e.g. "7f8a9b00-..../screenshot_2026-05-20.png"
-- Only platform_admin has any access.
-- =============================================================================

-- ─── SELECT ───────────────────────────────────────────────────────────────────
drop policy if exists "admin read moderation evidence" on storage.objects;
create policy "admin read moderation evidence"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'moderation-evidence'
    and (select role from public.profiles where id = auth.uid()) = 'platform_admin'
  );

-- ─── INSERT ───────────────────────────────────────────────────────────────────
drop policy if exists "admin upload moderation evidence" on storage.objects;
create policy "admin upload moderation evidence"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'moderation-evidence'
    and (select role from public.profiles where id = auth.uid()) = 'platform_admin'
  );

-- ─── UPDATE ───────────────────────────────────────────────────────────────────
drop policy if exists "admin update moderation evidence" on storage.objects;
create policy "admin update moderation evidence"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'moderation-evidence'
    and (select role from public.profiles where id = auth.uid()) = 'platform_admin'
  )
  with check (
    bucket_id = 'moderation-evidence'
    and (select role from public.profiles where id = auth.uid()) = 'platform_admin'
  );

-- ─── DELETE ───────────────────────────────────────────────────────────────────
drop policy if exists "admin delete moderation evidence" on storage.objects;
create policy "admin delete moderation evidence"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'moderation-evidence'
    and (select role from public.profiles where id = auth.uid()) = 'platform_admin'
  );

-- =============================================================================
-- SECTION 3: authorize_church_doc_access()
-- Server-side gate function called from a Next.js API route / Edge Function
-- BEFORE generating a signed URL with the service_role client.
-- Pattern (in your API route):
--   1. Get caller's JWT → supabase client (anon key + user JWT)
--   2. Call: supabase.rpc('authorize_church_doc_access', { p_church_id, p_path })
--   3. If it returns p_path (no exception), generate signed URL server-side:
--        adminSupabase.storage.from('church-documents').createSignedUrl(path, 300)
--   4. Return signed URL to client.
-- NEVER call storage.createSignedUrl() from browser/client code.
-- =============================================================================
create or replace function public.authorize_church_doc_access(
  p_church_id uuid,
  p_path      text
)
  returns text
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_role      text;
  v_church_id uuid;
begin
  -- Resolve caller's role and church affiliation.
  select role, church_id
  into   v_role, v_church_id
  from   public.profiles
  where  id = auth.uid();

  if v_role is null then
    raise exception 'Unauthorized: profile not found';
  end if;

  -- Platform admin: unrestricted access to any church document.
  if v_role = 'platform_admin' then
    -- Log the access for audit trail.
    insert into public.document_access_log(user_id, doc_path, church_id)
    values (auth.uid(), p_path, p_church_id);
    return p_path;
  end if;

  -- Church admin: only their own church documents.
  if v_role = 'church_admin' then
    if v_church_id is null or v_church_id <> p_church_id then
      raise exception 'Unauthorized: you do not administer this church';
    end if;

    -- Verify path belongs to this church (first segment = church_id).
    if not (p_path like (p_church_id::text || '/%')) then
      raise exception 'Unauthorized: path does not belong to church %', p_church_id;
    end if;

    -- Log the access.
    insert into public.document_access_log(user_id, doc_path, church_id)
    values (auth.uid(), p_path, p_church_id);

    return p_path;
  end if;

  -- All other roles (member, etc.) are denied.
  raise exception 'Unauthorized: you do not have access to church documents';
end;
$$;

revoke all on function public.authorize_church_doc_access(uuid, text) from public, anon;
grant execute on function public.authorize_church_doc_access(uuid, text) to authenticated;

-- =============================================================================
-- SECTION 4: document_access_log
-- Immutable audit log written by authorize_church_doc_access() above.
-- No direct INSERT policy — only the SECURITY DEFINER function can write rows.
-- =============================================================================
create table if not exists public.document_access_log (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  doc_path    text        not null,
  church_id   uuid,
  accessed_at timestamptz not null default now()
);

alter table public.document_access_log enable row level security;

-- Only platform_admin may query the log.
drop policy if exists "doc_access_log admin only" on public.document_access_log;
create policy "doc_access_log admin only" on public.document_access_log
  for select to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin')
  );

-- No INSERT policy via RLS — rows are written exclusively by
-- authorize_church_doc_access() (SECURITY DEFINER), which bypasses RLS.
-- This ensures the log cannot be tampered with or forged by direct INSERT.

create index if not exists idx_doc_access_log_user    on public.document_access_log(user_id);
create index if not exists idx_doc_access_log_church  on public.document_access_log(church_id);
create index if not exists idx_doc_access_log_time    on public.document_access_log(accessed_at desc);

-- Revoke anon access to this table at the grant layer.
revoke all on public.document_access_log from anon;

-- =============================================================================
-- SECTION 5: SIGNED URL HELPER FOR MODERATION EVIDENCE
-- Separate gate for the moderation-evidence bucket. Called from admin UI
-- server actions only.
-- =============================================================================
create or replace function public.authorize_moderation_evidence_access(p_path text)
  returns text
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'platform_admin') then
    raise exception 'Unauthorized: only platform_admin can access moderation evidence';
  end if;

  -- Log moderation evidence access.
  insert into public.document_access_log(user_id, doc_path, church_id)
  values (auth.uid(), 'moderation-evidence/' || p_path, null);

  return p_path;
end;
$$;

revoke all on function public.authorize_moderation_evidence_access(text) from public, anon;
grant execute on function public.authorize_moderation_evidence_access(text) to authenticated;

-- =============================================================================
-- SECTION 6: EXISTING MEDIA BUCKETS — tighten upload policies
-- The 'media' bucket was created in supabase-migration.sql as public=true.
-- The policy there allows any authenticated user to upload to any path.
-- Replace with an owner-scoped upload policy so users cannot overwrite
-- each other's media. Reads remain public.
-- =============================================================================

-- Drop the loose "allow authenticated uploads" policy added by migration.
drop policy if exists "allow authenticated uploads" on storage.objects;

-- Re-create: authenticated users can upload, but only to a path that starts
-- with their own user_id (e.g. "<user_id>/post-images/foo.jpg").
-- This prevents one user from overwriting another user's media files.
create policy "authenticated upload own media" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to delete their own media files.
drop policy if exists "authenticated delete own media" on storage.objects;
create policy "authenticated delete own media" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Platform admin can delete any media (for moderation removal).
drop policy if exists "admin delete any media" on storage.objects;
create policy "admin delete any media" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'media'
    and (select role from public.profiles where id = auth.uid()) = 'platform_admin'
  );

-- Public reads remain as set in supabase-migration.sql ("allow public reads").
-- No change needed there.

-- =============================================================================
-- SECTION 7: anon ACCESS LOCK FOR STORAGE
-- The anon role must not be able to read private buckets via the storage schema.
-- Public bucket reads for 'media' are handled by the "allow public reads" policy
-- (target role = public, which includes anon). Private buckets have no such policy.
-- This REVOKE is belt-and-suspenders at the Postgres grant level.
-- =============================================================================
revoke all on all tables    in schema storage from anon;
-- Note: Supabase re-grants storage.objects SELECT to anon for public buckets
-- via its internal bootstrap. Revoking here applies to application-level grants only.
-- The Supabase storage gateway enforces bucket-level public/private independently.
