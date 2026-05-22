"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import type { LiveEvent } from "../types";

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useViewerTracking(liveEventId: string, userId: string | null) {
  const [viewerCount, setViewerCount] = useState(0);
  const sessionIdRef = useRef<string>(generateSessionId());
  const viewerRowIdRef = useRef<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Join/leave tracking ───────────────────────────────────────────────────

  useEffect(() => {
    if (!liveEventId) return;

    const sessionId = sessionIdRef.current;

    const join = async () => {
      const { data } = await supabase
        .from("church_live_viewers")
        .upsert(
          [{ live_event_id: liveEventId, user_id: userId, session_id: sessionId }],
          { onConflict: "live_event_id,session_id" },
        )
        .select("id")
        .maybeSingle();

      if (data?.id) viewerRowIdRef.current = data.id;
    };

    const leave = async () => {
      const rowId = viewerRowIdRef.current;
      if (!rowId) return;
      // Use sendBeacon for beforeunload reliability on mobile
      const payload = JSON.stringify({ id: rowId, left_at: new Date().toISOString() });
      if (navigator.sendBeacon) {
        // Supabase REST for beacon (POST to patched row)
        const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/church_live_viewers?id=eq.${rowId}`;
        navigator.sendBeacon(url, payload);
      }
      // Also attempt a normal update
      await supabase
        .from("church_live_viewers")
        .update({ left_at: new Date().toISOString() })
        .eq("id", rowId);
    };

    void join();

    const handleBeforeUnload = () => { void leave(); };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") void leave();
      else void join();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibility);
      void leave();
    };
  }, [liveEventId, userId]);

  // ── Subscribe to viewer_count updates on the event row ───────────────────

  useEffect(() => {
    if (!liveEventId) return;

    // Seed from initial fetch
    supabase
      .from("church_live_events")
      .select("viewer_count")
      .eq("id", liveEventId)
      .maybeSingle()
      .then(({ data }) => { if (data) setViewerCount(data.viewer_count); });

    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const channel = supabase
      .channel(`live-event-meta-${liveEventId}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "church_live_events",
          filter: `id=eq.${liveEventId}`,
        },
        (payload) => {
          const ev = payload.new as Partial<LiveEvent>;
          if (typeof ev.viewer_count === "number") setViewerCount(ev.viewer_count);
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [liveEventId]);

  return { viewerCount };
}
