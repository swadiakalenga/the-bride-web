-- ============================================================
-- TheBride — analytics_events table
-- Run in Supabase SQL editor (idempotent)
-- ============================================================

-- ── 1. Table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  church_id     uuid        REFERENCES public.churches(id) ON DELETE SET NULL,
  event_type    text        NOT NULL,          -- e.g. 'post_create', 'login'
  entity_type   text,                          -- e.g. 'post', 'church', 'message'
  entity_id     uuid,                          -- FK to any table (untyped)
  route         text,                          -- window.location.pathname at fire time
  metadata      jsonb       DEFAULT '{}'::jsonb,
  user_agent    text,
  platform      text,                          -- 'web' | 'ios' | 'android'
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id    ON public.analytics_events (user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON public.analytics_events (event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_route      ON public.analytics_events (route);
CREATE INDEX IF NOT EXISTS idx_analytics_events_church_id  ON public.analytics_events (church_id);

-- ── 3. RLS ───────────────────────────────────────────────────
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Users can INSERT their own events (user_id must match their uid or be null)
DROP POLICY IF EXISTS "analytics_events_insert_own" ON public.analytics_events;
CREATE POLICY "analytics_events_insert_own"
  ON public.analytics_events FOR INSERT
  WITH CHECK (
    user_id IS NULL OR user_id = auth.uid()
  );

-- Users cannot SELECT their own events (no self-inspection)
-- Platform admin can SELECT all events
DROP POLICY IF EXISTS "analytics_events_select_admin" ON public.analytics_events;
CREATE POLICY "analytics_events_select_admin"
  ON public.analytics_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'platform_admin'
    )
  );

-- No UPDATE or DELETE for anyone (append-only log)

-- ── 4. admin_get_kpis RPC ────────────────────────────────────
-- Replaces the old admin_get_stats, returns richer KPI set.
-- Safe to run multiple times (CREATE OR REPLACE).
CREATE OR REPLACE FUNCTION public.admin_get_kpis()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Only platform_admin may call this
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'platform_admin'
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT jsonb_build_object(
    'total_users',           (SELECT COUNT(*) FROM profiles),
    'active_users_today',    (
      SELECT COUNT(DISTINCT user_id)
      FROM analytics_events
      WHERE created_at >= CURRENT_DATE
    ),
    'active_users_week',     (
      SELECT COUNT(DISTINCT user_id)
      FROM analytics_events
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
    ),
    'total_churches',        (SELECT COUNT(*) FROM churches),
    'posts_today',           (
      SELECT COUNT(*) FROM posts
      WHERE created_at >= CURRENT_DATE
    ),
    'messages_today',        (
      SELECT COUNT(*) FROM messages
      WHERE created_at >= CURRENT_DATE
    ),
    'donations_total_cents', (
      SELECT COALESCE(SUM(amount_cents), 0) FROM donations
      WHERE status = 'completed'
    ),
    'open_support_tickets',  (
      SELECT COUNT(*) FROM support_tickets
      WHERE status IN ('open', 'in_progress')
    ),
    'pending_reports',       (
      SELECT COUNT(*) FROM reports
      WHERE status = 'pending'
    ),
    'active_live_streams',   (
      SELECT COUNT(*) FROM church_live_events
      WHERE is_live = true
    ),
    'pending_verifications', (
      SELECT COUNT(*) FROM church_verifications
      WHERE status = 'pending'
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_kpis() TO authenticated;

-- ── 5. admin_get_analytics RPC ───────────────────────────────
-- Powers /admin/analytics — aggregates over analytics_events.
CREATE OR REPLACE FUNCTION public.admin_get_analytics(p_days int DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_since  timestamptz := now() - (p_days || ' days')::interval;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'platform_admin'
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT jsonb_build_object(
    -- Daily active users for last p_days
    'daily_active', (
      SELECT jsonb_agg(row ORDER BY row->>'date')
      FROM (
        SELECT jsonb_build_object(
          'date',  TO_CHAR(created_at::date, 'YYYY-MM-DD'),
          'count', COUNT(DISTINCT user_id)
        ) AS row
        FROM analytics_events
        WHERE created_at >= v_since
        GROUP BY created_at::date
      ) sub
    ),
    -- Event type breakdown
    'by_event_type', (
      SELECT jsonb_agg(row ORDER BY (row->>'count')::int DESC)
      FROM (
        SELECT jsonb_build_object(
          'event_type', event_type,
          'count',      COUNT(*)
        ) AS row
        FROM analytics_events
        WHERE created_at >= v_since
        GROUP BY event_type
      ) sub
    ),
    -- Top routes
    'top_routes', (
      SELECT jsonb_agg(row ORDER BY (row->>'count')::int DESC)
      FROM (
        SELECT jsonb_build_object(
          'route', COALESCE(route, '(unknown)'),
          'count', COUNT(*)
        ) AS row
        FROM analytics_events
        WHERE created_at >= v_since AND route IS NOT NULL
        GROUP BY route
        ORDER BY COUNT(*) DESC
        LIMIT 10
      ) sub
    ),
    -- Church engagement (events linked to a church)
    'church_engagement', (
      SELECT jsonb_agg(row ORDER BY (row->>'count')::int DESC)
      FROM (
        SELECT jsonb_build_object(
          'church_id',   ae.church_id,
          'church_name', c.name,
          'count',       COUNT(*)
        ) AS row
        FROM analytics_events ae
        JOIN churches c ON c.id = ae.church_id
        WHERE ae.created_at >= v_since AND ae.church_id IS NOT NULL
        GROUP BY ae.church_id, c.name
        ORDER BY COUNT(*) DESC
        LIMIT 10
      ) sub
    ),
    -- Recent 50 events
    'recent_events', (
      SELECT jsonb_agg(row ORDER BY row->>'created_at' DESC)
      FROM (
        SELECT jsonb_build_object(
          'id',         ae.id,
          'event_type', ae.event_type,
          'route',      ae.route,
          'platform',   ae.platform,
          'created_at', ae.created_at,
          'user_name',  p.full_name
        ) AS row
        FROM analytics_events ae
        LEFT JOIN profiles p ON p.id = ae.user_id
        ORDER BY ae.created_at DESC
        LIMIT 50
      ) sub
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_analytics(int) TO authenticated;
