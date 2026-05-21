-- ═══════════════════════════════════════════════════════════════════════════
-- TheBride — Church verification RLS fix
-- Run once in Supabase SQL editor (idempotent — safe to re-run)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── church_verifications: church_admin can INSERT their own church ─────────
DROP POLICY IF EXISTS "church_admin_insert_verification" ON public.church_verifications;

CREATE POLICY "church_admin_insert_verification"
ON public.church_verifications FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id        = auth.uid()
      AND role      = 'church_admin'
      AND church_id = church_verifications.church_id
  )
);

-- ── church_verifications: church_admin + platform_admin can SELECT ─────────
DROP POLICY IF EXISTS "church_admin_select_verification" ON public.church_verifications;

CREATE POLICY "church_admin_select_verification"
ON public.church_verifications FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id        = auth.uid()
      AND role      = 'church_admin'
      AND church_id = church_verifications.church_id
  )
  OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id   = auth.uid()
      AND role = 'platform_admin'
  )
);

-- ── church_verifications: church_admin can UPDATE (resubmit) ──────────────
-- Required so upsert with onConflict:"church_id" works for resubmission
DROP POLICY IF EXISTS "church_admin_update_verification" ON public.church_verifications;

CREATE POLICY "church_admin_update_verification"
ON public.church_verifications FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id        = auth.uid()
      AND role      = 'church_admin'
      AND church_id = church_verifications.church_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id        = auth.uid()
      AND role      = 'church_admin'
      AND church_id = church_verifications.church_id
  )
);

-- ── church_verifications: platform_admin can UPDATE (approve/reject) ───────
-- Note: a broader platform_admin SELECT policy may already exist from
-- supabase-church-account-fixes.sql — this adds the UPDATE half.
DROP POLICY IF EXISTS "platform_admin_update_verification" ON public.church_verifications;

CREATE POLICY "platform_admin_update_verification"
ON public.church_verifications FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id   = auth.uid()
      AND role = 'platform_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id   = auth.uid()
      AND role = 'platform_admin'
  )
);

-- ══════════════════════════════════════════════════════════════════════════
-- Storage: church-documents bucket (private)
-- Path convention: {churchId}/{userId}/{filename}  (always 3 segments)
--   (storage.foldername(name))[1] = churchId
--   (storage.foldername(name))[2] = userId
-- ══════════════════════════════════════════════════════════════════════════

-- ── church_admin can INSERT into their own church folder ──────────────────
DROP POLICY IF EXISTS "church_admin_insert_church_documents" ON storage.objects;

CREATE POLICY "church_admin_insert_church_documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'church-documents'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id              = auth.uid()
      AND role            = 'church_admin'
      AND church_id::text = (storage.foldername(name))[1]
  )
  AND (storage.foldername(name))[2]::uuid = auth.uid()
);

-- ── church_admin can SELECT files from their own church folder ────────────
DROP POLICY IF EXISTS "church_admin_select_church_documents" ON storage.objects;

CREATE POLICY "church_admin_select_church_documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'church-documents'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id              = auth.uid()
      AND role            = 'church_admin'
      AND church_id::text = (storage.foldername(name))[1]
  )
);

-- ── platform_admin can SELECT all church documents (for review) ───────────
DROP POLICY IF EXISTS "platform_admin_select_church_documents" ON storage.objects;

CREATE POLICY "platform_admin_select_church_documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'church-documents'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id   = auth.uid()
      AND role = 'platform_admin'
  )
);

-- ── platform_admin can DELETE church documents ────────────────────────────
DROP POLICY IF EXISTS "platform_admin_delete_church_documents" ON storage.objects;

CREATE POLICY "platform_admin_delete_church_documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'church-documents'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id   = auth.uid()
      AND role = 'platform_admin'
  )
);

-- ── Done ──────────────────────────────────────────────────────────────────
-- After running, verify:
-- 1. Church admin can submit verification (no RLS error)
-- 2. Church admin can re-submit (upsert) an existing verification
-- 3. Platform admin can view all verifications in /admin/verifications
-- 4. Platform admin can approve/reject verifications
-- 5. Church-documents bucket is set to PRIVATE in Supabase dashboard
--    (Storage → Buckets → church-documents → toggle "Public" OFF)
