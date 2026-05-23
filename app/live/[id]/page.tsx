"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import type { LiveEvent } from "../../../lib/types";
import HLSPlayer from "../../components/live/HLSPlayer";
import LiveChat from "../../components/live/LiveChat";
import LiveReactions from "../../components/live/LiveReactions";
import AdminLiveControls from "../../components/live/AdminLiveControls";
import { useLiveChat } from "../../../lib/hooks/useLiveChat";
import { useLiveReactions } from "../../../lib/hooks/useLiveReactions";
import { useViewerTracking } from "../../../lib/hooks/useViewerTracking";

const EVENT_COLS = `
  id, church_id, created_by, title, description, thumbnail_url,
  scheduled_for, started_at, ended_at, status,
  stream_input_id, playback_url, hls_url,
  viewer_count, replay_enabled, created_at,
  stream_key, provider, playback_id,
  churches(name, avatar_url, pastor_name)
`;

type ChurchJoin = { name?: string | null; avatar_url?: string | null; pastor_name?: string | null };
type LiveEventExt = LiveEvent & { pastor_name?: string | null };

function normaliseEvent(row: Record<string, unknown>): LiveEventExt {
  const church = row.churches as ChurchJoin | null;
  return {
    ...(row as Omit<LiveEvent, "church_name" | "church_avatar">),
    church_name:   church?.name ?? null,
    church_avatar: church?.avatar_url ?? null,
    pastor_name:   church?.pastor_name ?? null,
  } as LiveEventExt;
}

function formatStarted(dateStr: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " · " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function LiveWatchPage() {
  const params = useParams();
  const router = useRouter();
  const liveEventId = params.id as string;

  const [event, setEvent]                 = useState<LiveEventExt | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin]             = useState(false);
  const [loading, setLoading]             = useState(true);
  const [notFound, setNotFound]           = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  const eventChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Load event ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!liveEventId) return;
    let mounted = true;

    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      const me = authData.user?.id ?? null;
      if (!mounted) return;
      setCurrentUserId(me);

      const { data, error } = await supabase
        .from("church_live_events")
        .select(EVENT_COLS)
        .eq("id", liveEventId)
        .maybeSingle();

      if (!mounted) return;

      if (error || !data) { setNotFound(true); setLoading(false); return; }

      const ev = normaliseEvent(data as Record<string, unknown>);
      setEvent(ev);

      if (me) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, church_id")
          .eq("id", me)
          .maybeSingle();
        if (mounted && profile?.role === "church_admin" && profile.church_id === ev.church_id) {
          setIsAdmin(true);
        }
      }

      setLoading(false);
    })();

    return () => { mounted = false; };
  }, [liveEventId]);

  // ── Realtime: event status / viewer_count updates ────────────────────────

  useEffect(() => {
    if (!liveEventId) return;

    if (eventChannelRef.current) supabase.removeChannel(eventChannelRef.current);

    const channel = supabase
      .channel(`live-event-watch-${liveEventId}-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "church_live_events", filter: `id=eq.${liveEventId}` },
        (payload) => {
          setEvent((prev) => prev ? { ...prev, ...(payload.new as Partial<LiveEvent>) } : prev);
        },
      )
      .subscribe();

    eventChannelRef.current = channel;

    return () => {
      if (eventChannelRef.current) supabase.removeChannel(eventChannelRef.current);
    };
  }, [liveEventId]);

  // ── Capacitor app resume ──────────────────────────────────────────────────

  useEffect(() => {
    let removeListener: (() => void) | undefined;

    (async () => {
      try {
        const { App: CapApp } = await import("@capacitor/app");
        const handle = await CapApp.addListener("appStateChange", async ({ isActive }) => {
          if (!isActive || !liveEventId) return;
          const { data } = await supabase
            .from("church_live_events")
            .select("status, viewer_count, hls_url, started_at, ended_at")
            .eq("id", liveEventId)
            .maybeSingle();
          if (data) setEvent((prev) => prev ? { ...prev, ...data } : prev);
        });
        removeListener = () => handle.remove();
      } catch { /* web — no Capacitor */ }
    })();

    return () => removeListener?.();
  }, [liveEventId]);

  // ── Module hooks ─────────────────────────────────────────────────────────

  const { messages, sending, sendMessage } = useLiveChat(liveEventId, currentUserId);
  const { floatingReactions, sendReaction } = useLiveReactions(liveEventId, currentUserId);
  const { viewerCount } = useViewerTracking(liveEventId, currentUserId);

  // ── States ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
      </div>
    );
  }

  if (notFound || !event) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-black gap-4">
        <span className="text-5xl">📡</span>
        <p className="text-lg font-bold text-white">Stream not found</p>
        <button
          onClick={() => router.push("/live")}
          className="rounded-full bg-amber-400 px-5 py-2 text-sm font-bold text-white hover:bg-amber-500"
        >
          Browse streams
        </button>
      </div>
    );
  }

  const isLive    = event.status === "live";
  const isEnded   = event.status === "ended";
  const hasPlayer = !!event.hls_url && (isLive || (isEnded && event.replay_enabled));

  return (
    <div className="flex h-screen flex-col bg-black lg:flex-row">

      {/* ── Main: player + info ── */}
      <div className="flex flex-1 min-h-0 flex-col">

        {/* Back */}
        <button
          onClick={() => router.push("/live")}
          className="absolute left-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70"
          aria-label="Back"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {/* Player */}
        <div className="relative w-full flex-shrink-0 bg-black">
          {hasPlayer ? (
            <HLSPlayer hlsUrl={event.hls_url!} poster={event.thumbnail_url} autoPlay={isLive} />
          ) : (
            <div className="flex flex-col items-center justify-center text-white" style={{ aspectRatio: "16/9" }}>
              {event.status === "scheduled" ? (
                <>
                  <span className="text-5xl mb-3">📅</span>
                  <p className="text-lg font-bold">Stream hasn&apos;t started yet</p>
                  {event.scheduled_for && (
                    <p className="mt-1 text-sm text-gray-400">
                      Scheduled for {formatStarted(event.scheduled_for)}
                    </p>
                  )}
                </>
              ) : event.status === "ended" && !event.replay_enabled ? (
                <>
                  <span className="text-5xl mb-3">🎬</span>
                  <p className="text-lg font-bold">Stream ended</p>
                  <p className="mt-1 text-sm text-gray-400">Replay not available.</p>
                </>
              ) : isLive ? (
                <>
                  <span className="text-5xl mb-3">📡</span>
                  <p className="text-lg font-bold text-white">Stream is live but video is still connecting.</p>
                  <p className="mt-1 text-sm text-gray-400">Refresh in a moment — the stream will appear shortly.</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-4 rounded-full bg-amber-400 px-5 py-2 text-sm font-bold text-white hover:bg-amber-500"
                  >
                    Refresh
                  </button>
                </>
              ) : (
                <>
                  <span className="text-5xl mb-3">📡</span>
                  <p className="text-lg font-bold">Stream unavailable</p>
                </>
              )}
            </div>
          )}

          {/* Floating reactions on player (pointers go through) */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {floatingReactions.map((r) => (
              <div
                key={r.key}
                className="absolute bottom-0 text-2xl"
                style={{
                  right: `${r.x}%`,
                  animation: "floatUp 2.8s ease-out forwards",
                }}
              >
                {r.reaction_type}
              </div>
            ))}
          </div>

          {/* Badges */}
          <div className="absolute left-3 bottom-12 flex items-center gap-2 z-10">
            {isLive && (
              <span className="flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                Live
              </span>
            )}
            {isEnded && event.replay_enabled && (
              <span className="rounded-full bg-gray-700/80 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow">
                Replay
              </span>
            )}
            {viewerCount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] text-white">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                </svg>
                {viewerCount.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Reactions bar — mobile only, above info */}
        {isLive && currentUserId && (
          <div className="flex-shrink-0 bg-black/90 lg:hidden">
            <LiveReactions
              floatingReactions={[]}
              onReact={sendReaction}
              disabled={!currentUserId}
            />
          </div>
        )}

        {/* Info */}
        <div className="flex-1 overflow-y-auto bg-gray-900 px-4 py-4 space-y-4">
          <div>
            <h1 className="text-lg font-bold leading-snug text-white">{event.title}</h1>
            <button
              onClick={() => router.push(`/church/${event.church_id}`)}
              className="mt-2 flex items-center gap-2.5"
            >
              {event.church_avatar ? (
                <img src={event.church_avatar} alt="" className="h-9 w-9 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-sm font-bold text-white">
                  {(event.church_name || "C").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="text-left">
                <p className="text-sm font-semibold text-white">{event.church_name}</p>
                {event.pastor_name && (
                  <p className="text-[11px] text-gray-400">Pastor {event.pastor_name}</p>
                )}
              </div>
            </button>
          </div>

          {event.description && (
            <p className="text-sm leading-relaxed text-gray-300">{event.description}</p>
          )}

          {event.started_at && (
            <p className="text-xs text-gray-500">
              {isEnded ? "Streamed" : "Started"} {formatStarted(event.started_at)}
            </p>
          )}

          {isAdmin && (
            <AdminLiveControls
              event={event}
              onEventUpdated={(updated) => setEvent((prev) => prev ? { ...prev, ...updated } : prev)}
            />
          )}

          {/* Mobile chat toggle */}
          <button
            onClick={() => setMobileChatOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 py-3 text-sm font-semibold text-white hover:bg-white/5 lg:hidden"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
            </svg>
            {isLive ? "Open live chat" : "View chat"}
            {messages.length > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {messages.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Desktop chat sidebar ── */}
      <div className="hidden w-80 flex-shrink-0 flex-col border-l border-white/10 bg-gray-900 lg:flex">
        {isLive && currentUserId && (
          <div className="flex-shrink-0 border-b border-white/10">
            <LiveReactions
              floatingReactions={[]}
              onReact={sendReaction}
              disabled={!currentUserId}
            />
          </div>
        )}
        <LiveChat
          messages={messages}
          sending={sending}
          currentUserId={currentUserId}
          onSend={sendMessage}
          className="flex-1 min-h-0"
        />
      </div>

      {/* ── Mobile chat drawer ── */}
      {mobileChatOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-gray-900 lg:hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <span className="text-sm font-bold text-white">
              {isLive ? "Live Chat" : "Chat replay"}
            </span>
            <button
              onClick={() => setMobileChatOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white hover:bg-white/10"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <LiveChat
            messages={messages}
            sending={sending}
            currentUserId={currentUserId}
            onSend={sendMessage}
            className="flex-1 min-h-0"
          />
        </div>
      )}
    </div>
  );
}
