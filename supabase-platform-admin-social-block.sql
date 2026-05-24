-- ============================================================
-- Platform Admin Social Block
-- Adds RESTRICTIVE RLS policies so that platform_admin accounts
-- cannot write to any social table, even via direct API calls.
--
-- How Postgres RLS works here:
--   Permissive policies (default): row is visible if ANY passes  (OR)
--   Restrictive policies (AS RESTRICTIVE): row is visible only if ALL pass (AND)
--
-- Adding a RESTRICTIVE policy means the row is allowed only when
-- BOTH the existing permissive policies AND this policy agree.
-- platform_admin fails the check → operation is rejected with 403.
--
-- REQUIREMENTS:
--   RLS must be enabled on each table. Run:
--     ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;
--   if it is not already. This script includes those statements
--   (they are no-ops when RLS is already enabled).
--
-- This script is idempotent: safe to re-run.
-- ============================================================

-- ── Reusable condition (replicated inline for clarity) ───────────────────────
-- NOT EXISTS (
--   SELECT 1 FROM public.profiles
--   WHERE profiles.id = auth.uid()
--   AND   profiles.role = 'platform_admin'
-- )

-- ============================================================
-- 1. posts
-- ============================================================
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "block_platform_admin_posts_insert" ON public.posts;
CREATE POLICY "block_platform_admin_posts_insert"
  ON public.posts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "block_platform_admin_posts_update" ON public.posts;
CREATE POLICY "block_platform_admin_posts_update"
  ON public.posts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  )
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "block_platform_admin_posts_delete" ON public.posts;
CREATE POLICY "block_platform_admin_posts_delete"
  ON public.posts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

-- ============================================================
-- 2. likes
-- ============================================================
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "block_platform_admin_likes_insert" ON public.likes;
CREATE POLICY "block_platform_admin_likes_insert"
  ON public.likes AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "block_platform_admin_likes_update" ON public.likes;
CREATE POLICY "block_platform_admin_likes_update"
  ON public.likes AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  )
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "block_platform_admin_likes_delete" ON public.likes;
CREATE POLICY "block_platform_admin_likes_delete"
  ON public.likes AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

-- ============================================================
-- 3. comments
-- ============================================================
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "block_platform_admin_comments_insert" ON public.comments;
CREATE POLICY "block_platform_admin_comments_insert"
  ON public.comments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "block_platform_admin_comments_update" ON public.comments;
CREATE POLICY "block_platform_admin_comments_update"
  ON public.comments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  )
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "block_platform_admin_comments_delete" ON public.comments;
CREATE POLICY "block_platform_admin_comments_delete"
  ON public.comments AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

-- ============================================================
-- 4. follows
-- ============================================================
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "block_platform_admin_follows_insert" ON public.follows;
CREATE POLICY "block_platform_admin_follows_insert"
  ON public.follows AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "block_platform_admin_follows_update" ON public.follows;
CREATE POLICY "block_platform_admin_follows_update"
  ON public.follows AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  )
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "block_platform_admin_follows_delete" ON public.follows;
CREATE POLICY "block_platform_admin_follows_delete"
  ON public.follows AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

-- ============================================================
-- 5. church_follows
-- ============================================================
ALTER TABLE public.church_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "block_platform_admin_church_follows_insert" ON public.church_follows;
CREATE POLICY "block_platform_admin_church_follows_insert"
  ON public.church_follows AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "block_platform_admin_church_follows_update" ON public.church_follows;
CREATE POLICY "block_platform_admin_church_follows_update"
  ON public.church_follows AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  )
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "block_platform_admin_church_follows_delete" ON public.church_follows;
CREATE POLICY "block_platform_admin_church_follows_delete"
  ON public.church_follows AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

-- ============================================================
-- 6. messages
-- ============================================================
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "block_platform_admin_messages_insert" ON public.messages;
CREATE POLICY "block_platform_admin_messages_insert"
  ON public.messages AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "block_platform_admin_messages_update" ON public.messages;
CREATE POLICY "block_platform_admin_messages_update"
  ON public.messages AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  )
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "block_platform_admin_messages_delete" ON public.messages;
CREATE POLICY "block_platform_admin_messages_delete"
  ON public.messages AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

-- ============================================================
-- 7. message_requests
-- ============================================================
ALTER TABLE public.message_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "block_platform_admin_message_requests_insert" ON public.message_requests;
CREATE POLICY "block_platform_admin_message_requests_insert"
  ON public.message_requests AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "block_platform_admin_message_requests_update" ON public.message_requests;
CREATE POLICY "block_platform_admin_message_requests_update"
  ON public.message_requests AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  )
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "block_platform_admin_message_requests_delete" ON public.message_requests;
CREATE POLICY "block_platform_admin_message_requests_delete"
  ON public.message_requests AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

-- ============================================================
-- 8. church_memberships
-- ============================================================
ALTER TABLE public.church_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "block_platform_admin_church_memberships_insert" ON public.church_memberships;
CREATE POLICY "block_platform_admin_church_memberships_insert"
  ON public.church_memberships AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "block_platform_admin_church_memberships_update" ON public.church_memberships;
CREATE POLICY "block_platform_admin_church_memberships_update"
  ON public.church_memberships AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  )
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "block_platform_admin_church_memberships_delete" ON public.church_memberships;
CREATE POLICY "block_platform_admin_church_memberships_delete"
  ON public.church_memberships AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

-- ============================================================
-- 9. donations
-- ============================================================
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "block_platform_admin_donations_insert" ON public.donations;
CREATE POLICY "block_platform_admin_donations_insert"
  ON public.donations AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "block_platform_admin_donations_update" ON public.donations;
CREATE POLICY "block_platform_admin_donations_update"
  ON public.donations AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  )
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "block_platform_admin_donations_delete" ON public.donations;
CREATE POLICY "block_platform_admin_donations_delete"
  ON public.donations AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

-- ============================================================
-- 10. church_live_events
-- ============================================================
ALTER TABLE public.church_live_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "block_platform_admin_church_live_events_insert" ON public.church_live_events;
CREATE POLICY "block_platform_admin_church_live_events_insert"
  ON public.church_live_events AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "block_platform_admin_church_live_events_update" ON public.church_live_events;
CREATE POLICY "block_platform_admin_church_live_events_update"
  ON public.church_live_events AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  )
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "block_platform_admin_church_live_events_delete" ON public.church_live_events;
CREATE POLICY "block_platform_admin_church_live_events_delete"
  ON public.church_live_events AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

-- ============================================================
-- 11. church_events
-- ============================================================
ALTER TABLE public.church_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "block_platform_admin_church_events_insert" ON public.church_events;
CREATE POLICY "block_platform_admin_church_events_insert"
  ON public.church_events AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "block_platform_admin_church_events_update" ON public.church_events;
CREATE POLICY "block_platform_admin_church_events_update"
  ON public.church_events AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  )
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "block_platform_admin_church_events_delete" ON public.church_events;
CREATE POLICY "block_platform_admin_church_events_delete"
  ON public.church_events AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

-- ============================================================
-- 12. prayer_requests
-- ============================================================
ALTER TABLE public.prayer_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "block_platform_admin_prayer_requests_insert" ON public.prayer_requests;
CREATE POLICY "block_platform_admin_prayer_requests_insert"
  ON public.prayer_requests AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "block_platform_admin_prayer_requests_update" ON public.prayer_requests;
CREATE POLICY "block_platform_admin_prayer_requests_update"
  ON public.prayer_requests AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  )
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "block_platform_admin_prayer_requests_delete" ON public.prayer_requests;
CREATE POLICY "block_platform_admin_prayer_requests_delete"
  ON public.prayer_requests AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

-- ============================================================
-- 13. devotionals
-- ============================================================
ALTER TABLE public.devotionals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "block_platform_admin_devotionals_insert" ON public.devotionals;
CREATE POLICY "block_platform_admin_devotionals_insert"
  ON public.devotionals AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "block_platform_admin_devotionals_update" ON public.devotionals;
CREATE POLICY "block_platform_admin_devotionals_update"
  ON public.devotionals AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  )
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "block_platform_admin_devotionals_delete" ON public.devotionals;
CREATE POLICY "block_platform_admin_devotionals_delete"
  ON public.devotionals AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
    )
  );

-- ============================================================
-- Done. 39 restrictive policies across 13 tables.
-- These complement the client-side guards in the app code.
-- The service_role key bypasses RLS — this is intentional for
-- legitimate server-side admin operations via API routes.
-- ============================================================
