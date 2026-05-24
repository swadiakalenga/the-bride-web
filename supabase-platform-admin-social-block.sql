-- ============================================================
-- Platform Admin Social Block  (corrected, idempotent)
-- ============================================================
-- Adds AS RESTRICTIVE RLS policies so that platform_admin
-- accounts cannot write to any social table, even when calling
-- Supabase directly with their JWT (browser devtools, Postman…).
--
-- How restrictive policies work in Postgres:
--   Permissive (default)  → row passes if ANY policy says yes  (OR)
--   Restrictive           → row passes only if ALL policies agree (AND)
--
--   Result: adding a restrictive block causes the row to be
--   rejected even when a permissive policy would otherwise allow it.
--
-- Idempotency:
--   Every policy is dropped before being re-created.
--   Every block is wrapped in DO $$ … $$ with an IF EXISTS check
--   so that missing tables cause a clean skip, never an error.
--
-- Tables removed vs previous version:
--   prayer_requests — does not exist in production (removed)
--   devotionals     — does not exist in production (removed)
--
-- Service-role note:
--   The service_role key bypasses RLS by design.
--   This is correct — server-side API routes use it legitimately.
-- ============================================================

-- Shared block format for each table:
--
-- DO $$ BEGIN
--   IF EXISTS (SELECT 1 FROM information_schema.tables
--              WHERE table_schema = 'public' AND table_name = '<table>') THEN
--
--     EXECUTE 'ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY';
--
--     EXECUTE 'DROP POLICY IF EXISTS "block_platform_admin_<table>_insert" ON public.<table>';
--     EXECUTE $p$ CREATE POLICY "block_platform_admin_<table>_insert"
--       ON public.<table> AS RESTRICTIVE FOR INSERT TO authenticated
--       WITH CHECK (
--         NOT EXISTS (
--           SELECT 1 FROM public.profiles
--           WHERE profiles.id = auth.uid() AND profiles.role = ''platform_admin''
--         )
--       ) $p$;
--     … (same for UPDATE / DELETE)
--
--   END IF;
-- END $$;

-- ============================================================
-- 1. posts
-- ============================================================
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'posts'
  ) THEN

    EXECUTE 'ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "block_platform_admin_posts_insert" ON public.posts';
    EXECUTE $p$
      CREATE POLICY "block_platform_admin_posts_insert"
        ON public.posts AS RESTRICTIVE FOR INSERT TO authenticated
        WITH CHECK (
          NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
          )
        )
    $p$;

    EXECUTE 'DROP POLICY IF EXISTS "block_platform_admin_posts_update" ON public.posts';
    EXECUTE $p$
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
        )
    $p$;

    EXECUTE 'DROP POLICY IF EXISTS "block_platform_admin_posts_delete" ON public.posts';
    EXECUTE $p$
      CREATE POLICY "block_platform_admin_posts_delete"
        ON public.posts AS RESTRICTIVE FOR DELETE TO authenticated
        USING (
          NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
          )
        )
    $p$;

  END IF;
END $$;

-- ============================================================
-- 2. likes
-- ============================================================
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'likes'
  ) THEN

    EXECUTE 'ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "block_platform_admin_likes_insert" ON public.likes';
    EXECUTE $p$
      CREATE POLICY "block_platform_admin_likes_insert"
        ON public.likes AS RESTRICTIVE FOR INSERT TO authenticated
        WITH CHECK (
          NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
          )
        )
    $p$;

    EXECUTE 'DROP POLICY IF EXISTS "block_platform_admin_likes_update" ON public.likes';
    EXECUTE $p$
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
        )
    $p$;

    EXECUTE 'DROP POLICY IF EXISTS "block_platform_admin_likes_delete" ON public.likes';
    EXECUTE $p$
      CREATE POLICY "block_platform_admin_likes_delete"
        ON public.likes AS RESTRICTIVE FOR DELETE TO authenticated
        USING (
          NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
          )
        )
    $p$;

  END IF;
END $$;

-- ============================================================
-- 3. comments
-- ============================================================
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'comments'
  ) THEN

    EXECUTE 'ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "block_platform_admin_comments_insert" ON public.comments';
    EXECUTE $p$
      CREATE POLICY "block_platform_admin_comments_insert"
        ON public.comments AS RESTRICTIVE FOR INSERT TO authenticated
        WITH CHECK (
          NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
          )
        )
    $p$;

    EXECUTE 'DROP POLICY IF EXISTS "block_platform_admin_comments_update" ON public.comments';
    EXECUTE $p$
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
        )
    $p$;

    EXECUTE 'DROP POLICY IF EXISTS "block_platform_admin_comments_delete" ON public.comments';
    EXECUTE $p$
      CREATE POLICY "block_platform_admin_comments_delete"
        ON public.comments AS RESTRICTIVE FOR DELETE TO authenticated
        USING (
          NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
          )
        )
    $p$;

  END IF;
END $$;

-- ============================================================
-- 4. follows
-- ============================================================
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'follows'
  ) THEN

    EXECUTE 'ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "block_platform_admin_follows_insert" ON public.follows';
    EXECUTE $p$
      CREATE POLICY "block_platform_admin_follows_insert"
        ON public.follows AS RESTRICTIVE FOR INSERT TO authenticated
        WITH CHECK (
          NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
          )
        )
    $p$;

    EXECUTE 'DROP POLICY IF EXISTS "block_platform_admin_follows_update" ON public.follows';
    EXECUTE $p$
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
        )
    $p$;

    EXECUTE 'DROP POLICY IF EXISTS "block_platform_admin_follows_delete" ON public.follows';
    EXECUTE $p$
      CREATE POLICY "block_platform_admin_follows_delete"
        ON public.follows AS RESTRICTIVE FOR DELETE TO authenticated
        USING (
          NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
          )
        )
    $p$;

  END IF;
END $$;

-- ============================================================
-- 5. church_follows
-- ============================================================
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'church_follows'
  ) THEN

    EXECUTE 'ALTER TABLE public.church_follows ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "block_platform_admin_church_follows_insert" ON public.church_follows';
    EXECUTE $p$
      CREATE POLICY "block_platform_admin_church_follows_insert"
        ON public.church_follows AS RESTRICTIVE FOR INSERT TO authenticated
        WITH CHECK (
          NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
          )
        )
    $p$;

    EXECUTE 'DROP POLICY IF EXISTS "block_platform_admin_church_follows_update" ON public.church_follows';
    EXECUTE $p$
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
        )
    $p$;

    EXECUTE 'DROP POLICY IF EXISTS "block_platform_admin_church_follows_delete" ON public.church_follows';
    EXECUTE $p$
      CREATE POLICY "block_platform_admin_church_follows_delete"
        ON public.church_follows AS RESTRICTIVE FOR DELETE TO authenticated
        USING (
          NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
          )
        )
    $p$;

  END IF;
END $$;

-- ============================================================
-- 6. messages
-- ============================================================
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'messages'
  ) THEN

    EXECUTE 'ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "block_platform_admin_messages_insert" ON public.messages';
    EXECUTE $p$
      CREATE POLICY "block_platform_admin_messages_insert"
        ON public.messages AS RESTRICTIVE FOR INSERT TO authenticated
        WITH CHECK (
          NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
          )
        )
    $p$;

    EXECUTE 'DROP POLICY IF EXISTS "block_platform_admin_messages_update" ON public.messages';
    EXECUTE $p$
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
        )
    $p$;

    EXECUTE 'DROP POLICY IF EXISTS "block_platform_admin_messages_delete" ON public.messages';
    EXECUTE $p$
      CREATE POLICY "block_platform_admin_messages_delete"
        ON public.messages AS RESTRICTIVE FOR DELETE TO authenticated
        USING (
          NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
          )
        )
    $p$;

  END IF;
END $$;

-- ============================================================
-- 7. message_requests
-- ============================================================
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'message_requests'
  ) THEN

    EXECUTE 'ALTER TABLE public.message_requests ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "block_platform_admin_message_requests_insert" ON public.message_requests';
    EXECUTE $p$
      CREATE POLICY "block_platform_admin_message_requests_insert"
        ON public.message_requests AS RESTRICTIVE FOR INSERT TO authenticated
        WITH CHECK (
          NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
          )
        )
    $p$;

    EXECUTE 'DROP POLICY IF EXISTS "block_platform_admin_message_requests_update" ON public.message_requests';
    EXECUTE $p$
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
        )
    $p$;

    EXECUTE 'DROP POLICY IF EXISTS "block_platform_admin_message_requests_delete" ON public.message_requests';
    EXECUTE $p$
      CREATE POLICY "block_platform_admin_message_requests_delete"
        ON public.message_requests AS RESTRICTIVE FOR DELETE TO authenticated
        USING (
          NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
          )
        )
    $p$;

  END IF;
END $$;

-- ============================================================
-- 8. church_memberships
-- ============================================================
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'church_memberships'
  ) THEN

    EXECUTE 'ALTER TABLE public.church_memberships ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "block_platform_admin_church_memberships_insert" ON public.church_memberships';
    EXECUTE $p$
      CREATE POLICY "block_platform_admin_church_memberships_insert"
        ON public.church_memberships AS RESTRICTIVE FOR INSERT TO authenticated
        WITH CHECK (
          NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
          )
        )
    $p$;

    EXECUTE 'DROP POLICY IF EXISTS "block_platform_admin_church_memberships_update" ON public.church_memberships';
    EXECUTE $p$
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
        )
    $p$;

    EXECUTE 'DROP POLICY IF EXISTS "block_platform_admin_church_memberships_delete" ON public.church_memberships';
    EXECUTE $p$
      CREATE POLICY "block_platform_admin_church_memberships_delete"
        ON public.church_memberships AS RESTRICTIVE FOR DELETE TO authenticated
        USING (
          NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
          )
        )
    $p$;

  END IF;
END $$;

-- ============================================================
-- 9. donations
-- ============================================================
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'donations'
  ) THEN

    EXECUTE 'ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "block_platform_admin_donations_insert" ON public.donations';
    EXECUTE $p$
      CREATE POLICY "block_platform_admin_donations_insert"
        ON public.donations AS RESTRICTIVE FOR INSERT TO authenticated
        WITH CHECK (
          NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
          )
        )
    $p$;

    EXECUTE 'DROP POLICY IF EXISTS "block_platform_admin_donations_update" ON public.donations';
    EXECUTE $p$
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
        )
    $p$;

    EXECUTE 'DROP POLICY IF EXISTS "block_platform_admin_donations_delete" ON public.donations';
    EXECUTE $p$
      CREATE POLICY "block_platform_admin_donations_delete"
        ON public.donations AS RESTRICTIVE FOR DELETE TO authenticated
        USING (
          NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
          )
        )
    $p$;

  END IF;
END $$;

-- ============================================================
-- 10. church_live_events
-- ============================================================
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'church_live_events'
  ) THEN

    EXECUTE 'ALTER TABLE public.church_live_events ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "block_platform_admin_church_live_events_insert" ON public.church_live_events';
    EXECUTE $p$
      CREATE POLICY "block_platform_admin_church_live_events_insert"
        ON public.church_live_events AS RESTRICTIVE FOR INSERT TO authenticated
        WITH CHECK (
          NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
          )
        )
    $p$;

    EXECUTE 'DROP POLICY IF EXISTS "block_platform_admin_church_live_events_update" ON public.church_live_events';
    EXECUTE $p$
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
        )
    $p$;

    EXECUTE 'DROP POLICY IF EXISTS "block_platform_admin_church_live_events_delete" ON public.church_live_events';
    EXECUTE $p$
      CREATE POLICY "block_platform_admin_church_live_events_delete"
        ON public.church_live_events AS RESTRICTIVE FOR DELETE TO authenticated
        USING (
          NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
          )
        )
    $p$;

  END IF;
END $$;

-- ============================================================
-- 11. church_events
-- ============================================================
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'church_events'
  ) THEN

    EXECUTE 'ALTER TABLE public.church_events ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "block_platform_admin_church_events_insert" ON public.church_events';
    EXECUTE $p$
      CREATE POLICY "block_platform_admin_church_events_insert"
        ON public.church_events AS RESTRICTIVE FOR INSERT TO authenticated
        WITH CHECK (
          NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
          )
        )
    $p$;

    EXECUTE 'DROP POLICY IF EXISTS "block_platform_admin_church_events_update" ON public.church_events';
    EXECUTE $p$
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
        )
    $p$;

    EXECUTE 'DROP POLICY IF EXISTS "block_platform_admin_church_events_delete" ON public.church_events';
    EXECUTE $p$
      CREATE POLICY "block_platform_admin_church_events_delete"
        ON public.church_events AS RESTRICTIVE FOR DELETE TO authenticated
        USING (
          NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'platform_admin'
          )
        )
    $p$;

  END IF;
END $$;

-- ============================================================
-- Done. Up to 33 restrictive policies across 11 tables.
-- Each DO block silently skips if the table does not exist,
-- so this script is safe to run on any schema revision.
-- ============================================================
