"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import type { LiveEvent } from "../../lib/types";
import LiveEventCard from "../components/live/LiveEventCard";
import BottomNav from "../components/ui/BottomNav";

const EVENT_COLS = `
  id, church_id, created_by, title, description, thumbnail_url,
  scheduled_for, started_at, ended_at, status,
  stream_input_id, playback_url, hls_url,
  viewer_count, replay_enabled, created_at,
  churches(name, avatar_url)
`;

function normaliseEvent(row: Record<string, unknown>): LiveEvent {
  const church = row.churches as { name?: string | null; avatar_url?: string | null } | null;
  return {
    ...(row as Omit<LiveEvent, "church_name" | "church_avatar">),
    church_name:   church?.name ?? null,
    church_avatar: church?.avatar_url ?? null,
  } as LiveEvent;
}

type Section = { label: string; emoji: string; events: LiveEvent[] };

export default function LiveDiscoveryPage() {
  const router = useRouter();
  const [liveNow, setLiveNow]       = useState<LiveEvent[]>([]);
  const [scheduled, setScheduled]   = useState<LiveEvent[]>([]);
  const [replays, setReplays]       = useState<LiveEvent[]>([]);
  const [loading, setLoading]       = useState(true);
  const [isAdmin, setIsAdmin]       = useState(false);
  const [adminChurchId, setAdminChurchId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      const me = authData.user?.id;

      // Check if user is a church admin (can create events)
      if (me) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, church_id")
          .eq("id", me)
          .maybeSingle();
        if (mounted && profile?.role === "church_admin" && profile.church_id) {
          setIsAdmin(true);
          setAdminChurchId(profile.church_id);
        }
      }

      // Fetch events in parallel
      const [liveRes, scheduledRes, replayRes] = await Promise.all([
        supabase
          .from("church_live_events")
          .select(EVENT_COLS)
          .eq("status", "live")
          .order("started_at", { ascending: false })
          .limit(20),
        supabase
          .from("church_live_events")
          .select(EVENT_COLS)
          .eq("status", "scheduled")
          .gte("scheduled_for", new Date().toISOString())
          .order("scheduled_for", { ascending: true })
          .limit(20),
        supabase
          .from("church_live_events")
          .select(EVENT_COLS)
          .eq("status", "ended")
          .eq("replay_enabled", true)
          .not("hls_url", "is", null)
          .order("ended_at", { ascending: false })
          .limit(20),
      ]);

      if (!mounted) return;
      setLiveNow((liveRes.data ?? []).map(normaliseEvent));
      setScheduled((scheduledRes.data ?? []).map(normaliseEvent));
      setReplays((replayRes.data ?? []).map(normaliseEvent));
      setLoading(false);
    })();

    return () => { mounted = false; };
  }, []);

  const sections: Section[] = [
    { label: "Live Now",  emoji: "🔴", events: liveNow },
    { label: "Upcoming",  emoji: "📅", events: scheduled },
    { label: "Replays",   emoji: "🎬", events: replays },
  ];

  const isEmpty = !liveNow.length && !scheduled.length && !replays.length;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Live</h1>
            <p className="text-xs text-gray-400">Church broadcasts &amp; worship streams</p>
          </div>
          {isAdmin && adminChurchId && (
            <button
              onClick={() => router.push(`/live/create?church=${adminChurchId}`)}
              className="flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1.5 text-sm font-bold text-white shadow hover:bg-red-600"
            >
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              Schedule Stream
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6 space-y-10">
        {loading && (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
          </div>
        )}

        {!loading && isEmpty && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-5xl">📡</span>
            <p className="mt-4 text-lg font-bold text-gray-900">Nothing live right now</p>
            <p className="mt-1 text-sm text-gray-400">
              Follow churches to get notified when they go live.
            </p>
          </div>
        )}

        {!loading && sections.map(({ label, emoji, events }) => {
          if (!events.length) return null;
          return (
            <section key={label}>
              <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-gray-900">
                <span>{emoji}</span>
                {label}
                <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
                  {events.length}
                </span>
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {events.map((ev) => (
                  <LiveEventCard key={ev.id} event={ev} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
}
