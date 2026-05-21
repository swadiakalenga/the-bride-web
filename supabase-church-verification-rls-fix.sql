-- ═══════════════════════════════════════════════════════════════════════════
-- TheBride — Church verification RLS fix (v2)
-- Run once in Supabase SQL editor (idempotent — safe to re-run)
--
-- church_verifications policies: drop ALL known names, recreate 3 clean ones.
-- Storage policies: church-documents bucket (private).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── church_verifications: drop every known policy name ────────────────────

DROP POLICY IF EXISTS "church admin insert verification"             ON public.church_verifications;
DROP POLICY IF EXISTS "church admin select own verification"         ON public.church_verifications;
DROP POLICY IF EXISTS "church admin update own verification"         ON public.church_verifications;
DROP POLICY IF EXISTS "church_admin_insert_verification"             ON public.church_verifications;
DROP POLICY IF EXISTS "church_admin_select_verification"             ON public.church_verifications;
DROP POLICY IF EXISTS "church_admin_update_verification"             ON public.church_verifications;
DROP POLICY IF EXISTS "church_verifications insert admin no pending" ON public.church_verifications;
DROP POLICY IF EXISTS "church_verifications select admin"            ON public.church_verifications;
DROP POLICY IF EXISTS "church_verifications update platform admin"   ON public.church_verifications;
DROP POLICY IF EXISTS "platform_admin_update_verification"           ON public.church_verifications;
DROP POLICY IF EXISTS "platform_admin_read_verifications"            ON public.church_verifications;
DROP POLICY IF EXISTS "platform_admin_select_verification"           ON public.church_verifications;
DROP POLICY IF EXISTS "verif_church_admin"                           ON public.church_verifications;
DROP POLICY IF EXISTS "verif_platform_admin_select"                  ON public.church_verifications;
DROP POLICY IF EXISTS "verif_platform_admin_update"                  ON public.church_verifications;

-- ── church_verifications: 3 clean non-recursive policies ─────────────────
-- All USING / WITH CHECK reference only public.profiles — no recursion.

-- 1. church_admin: full access to their own church's verification row
CREATE POLICY "verif_church_admin"
ON public.church_verifications
FOR ALL
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

-- 2. platform_admin: read all verifications
CREATE POLICY "verif_platform_admin_select"
ON public.church_verifications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id   = auth.uid()
      AND role = 'platform_admin'
  )
);

-- 3. platform_admin: approve / reject (update status, rejection_reason)
CREATE POLICY "verif_platform_admin_update"
ON public.church_verifications
FOR UPDATE
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

-- church_admin can INSERT into their own church folder
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

-- church_admin can SELECT files from their own church folder
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

-- platform_admin can SELECT all church documents (for review)
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

-- platform_admin can DELETE church documents
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
