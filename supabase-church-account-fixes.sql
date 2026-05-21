-- ═══════════════════════════════════════════════════════════════════════════
-- TheBride — Church account fixes
-- Run once in Supabase SQL editor (idempotent — safe to re-run)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── BUG 6: Platform admin can read all churches ──────────────────────────────
-- Without this, the admin /churches page links work but the /church/[id] page
-- shows "Church not found" because the client-side query is blocked by RLS.

DROP POLICY IF EXISTS "platform_admin_read_churches" ON public.churches;

CREATE POLICY "platform_admin_read_churches"
ON public.churches FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id   = auth.uid()
      AND role = 'platform_admin'
  )
);

-- ── BUG 6: Platform admin can read all church_verifications ──────────────────
DROP POLICY IF EXISTS "platform_admin_read_verifications" ON public.church_verifications;

CREATE POLICY "platform_admin_read_verifications"
ON public.church_verifications FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id   = auth.uid()
      AND role = 'platform_admin'
  )
);

-- ── BUG 6: Platform admin can update churches (approve/reject payout etc.) ───
DROP POLICY IF EXISTS "platform_admin_update_churches" ON public.churches;

CREATE POLICY "platform_admin_update_churches"
ON public.churches FOR UPDATE
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

-- ── BUG 10: Church admins must not follow personal users ─────────────────────
-- RLS guard: prevent inserts into follows where the follower is a church_admin.
-- (The church_admin profile should not follow personal users.)

DROP POLICY IF EXISTS "personal_users_only_follow" ON public.follows;

CREATE POLICY "personal_users_only_follow"
ON public.follows FOR INSERT
TO authenticated
WITH CHECK (
  -- The inserting user must NOT be a church_admin
  NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id   = auth.uid()
      AND role = 'church_admin'
  )
);

-- ── BUG 10: Clean up existing follow rows from church_admin accounts ──────────
-- Remove all follows where the follower is a church_admin profile.
-- These were created before the guard was in place.
-- REVIEW before running: this deletes rows permanently.
DELETE FROM public.follows
WHERE follower_id IN (
  SELECT id FROM public.profiles WHERE role = 'church_admin'
);

-- ── BUG 1: Church events RLS — ensure church_admin can insert events ──────────
-- If church_events table has RLS and is missing an admin-insert policy,
-- the event creation silently fails. Add the policy if missing.

DROP POLICY IF EXISTS "church_admin_insert_events" ON public.church_events;

CREATE POLICY "church_admin_insert_events"
ON public.church_events FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id        = auth.uid()
      AND role      = 'church_admin'
      AND church_id = church_events.church_id
  )
);

DROP POLICY IF EXISTS "church_admin_delete_events" ON public.church_events;

CREATE POLICY "church_admin_delete_events"
ON public.church_events FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id        = auth.uid()
      AND role      = 'church_admin'
      AND church_id = church_events.church_id
  )
);

-- Allow all authenticated users to read events (needed for members/visitors)
DROP POLICY IF EXISTS "authenticated_read_events" ON public.church_events;

CREATE POLICY "authenticated_read_events"
ON public.church_events FOR SELECT
TO authenticated
USING (true);

-- ── church_admin can update their own church ──────────────────────────────────
-- Required for the profile page saveProfile() call.

DROP POLICY IF EXISTS "church_admin_update_own_church" ON public.churches;

CREATE POLICY "church_admin_update_own_church"
ON public.churches FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id        = auth.uid()
      AND role      = 'church_admin'
      AND church_id = churches.id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id        = auth.uid()
      AND role      = 'church_admin'
      AND church_id = churches.id
  )
);

-- ── Done ─────────────────────────────────────────────────────────────────────
-- After running:
-- 1. Verify platform_admin can open /church/[id] without "Church not found"
-- 2. Verify church_admin cannot follow personal users (test in UI)
-- 3. Verify church events insert works for church_admin
-- 4. Verify church profile edit (physical address) saves correctly
