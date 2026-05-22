"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import type { LiveReaction } from "../types";

export type FloatingReaction = {
  key: string;
  reaction_type: string;
  x: number; // 0-100 % from right edge
};

const ANIMATION_DURATION_MS = 2800;
const RECENT_LIMIT = 200;

export function useLiveReactions(liveEventId: string, userId: string | null) {
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const seenRef = useRef<Set<string>>(new Set());

  const spawnFloat = useCallback((reaction_type: string) => {
    const key = `${Date.now()}-${Math.random()}`;
    const x = Math.random() * 60 + 10; // 10-70% from right
    setFloatingReactions((prev) => [...prev, { key, reaction_type, x }]);
    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.key !== key));
    }, ANIMATION_DURATION_MS);
  }, []);

  // ── Realtime subscription ─────────────────────────────────────────────────

  useEffect(() => {
    if (!liveEventId) return;

    const subscribe = () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);

      // Load recent reactions to seed the seen-set (avoid replaying stale animations)
      supabase
        .from("church_live_reactions")
        .select("id")
        .eq("live_event_id", liveEventId)
        .order("created_at", { ascending: false })
        .limit(RECENT_LIMIT)
        .then(({ data }) => {
          if (data) data.forEach((r: { id: string }) => seenRef.current.add(r.id));
        });

      const channel = supabase
        .channel(`live-reactions-${liveEventId}-${Date.now()}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "church_live_reactions",
            filter: `live_event_id=eq.${liveEventId}`,
          },
          (payload) => {
            const r = payload.new as LiveReaction;
            if (seenRef.current.has(r.id)) return;
            seenRef.current.add(r.id);
            spawnFloat(r.reaction_type);
          },
        )
        .subscribe();

      channelRef.current = channel;
    };

    subscribe();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") subscribe();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [liveEventId, spawnFloat]);

  // ── Send reaction ─────────────────────────────────────────────────────────

  const sendReaction = useCallback(async (reaction_type: string) => {
    if (!userId) return;
    // Optimistic spawn immediately
    spawnFloat(reaction_type);
    await supabase.from("church_live_reactions").insert([{
      live_event_id: liveEventId,
      user_id: userId,
      reaction_type,
    }]);
  }, [liveEventId, userId, spawnFloat]);

  return { floatingReactions, sendReaction };
}
