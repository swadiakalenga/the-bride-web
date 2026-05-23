"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../../lib/supabase";
import type { LiveEvent } from "../../../../../lib/types";

const RTMP_SERVER = "rtmps://global-live.mux.com:443/app";

const MANAGE_COLS = `
  id, church_id, created_by, title, description, thumbnail_url,
  scheduled_for, started_at, ended_at, status,
  stream_input_id, hls_url, playback_url, playback_id, stream_key, provider,
  viewer_count, replay_enabled, created_at
`;

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return (
    d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}

// ── Per-event row ─────────────────────────────────────────────────────────────

type EventRowProps = {
  event: LiveEvent;
  token: string;
  onUpdated: (id: string, updates: Partial<LiveEvent>) => void;
  onRemoved: (id: string) => void;
};

function EventRow({ event, token, onUpdated, onRemoved }: EventRowProps) {
  const router = useRouter();
  const [working, setWorking]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [expanded, setExpanded]     = useState(false);
  const [showKey, setShowKey]       = useState(false);
  const [copied, setCopied]         = useState<"server" | "key" | null>(null);

  async function callApi(path: string): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ eventId: event.id }),
    });
    const json = await res.json() as { ok?: boolean; error?: string };
    return res.ok ? { ok: true } : { ok: false, error: json.error ?? "Request failed" };
  }

  const goLive = async () => {
    setWorking(true);
    setError(null);
    const result = await callApi("/api/live/start");
    setWorking(false);
    if (!result.ok) { setError(result.error ?? "Failed to go live"); return; }
    onUpdated(event.id, { status: "live", started_at: new Date().toISOString() });
  };

  const endStream = async () => {
    if (!confirm("End this live stream? It will be saved as a replay.")) return;
    setWorking(true);
    setError(null);
    const result = await callApi("/api/live/end");
    setWorking(false);
    if (!result.ok) { setError(result.error ?? "Failed to end stream"); return; }
    onUpdated(event.id, { status: "ended", ended_at: new Date().toISOString() });
  };

  const cancelEvent = async () => {
    if (!confirm("Cancel this scheduled stream? It will be removed from the list.")) return;
    setWorking(true);
    setError(null);
    const { error: err } = await supabase
      .from("church_live_events")
      .update({ status: "cancelled" })
      .eq("id", event.id);
    setWorking(false);
    if (err) { setError(err.message); return; }
    onRemoved(event.id);
  };

  const copyToClipboard = async (text: string, type: "server" | "key") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard API unavailable — silently ignore
    }
  };

  const statusColors: Record<string, string> = {
    scheduled: "bg-amber-100 text-amber-700",
    live:      "bg-red-100 text-red-700",
    ended:     "bg-gray-100 text-gray-500",
    cancelled: "bg-gray-100 text-gray-400",
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      {/* Main card row */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* Status + viewer count */}
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${statusColors[event.status] ?? "bg-gray-100 text-gray-500"}`}
              >
                {event.status === "live" && (
                  <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                )}
                {event.status}
              </span>
              {event.status === "live" && event.viewer_count > 0 && (
                <span className="text-xs text-gray-500">
                  {event.viewer_count.toLocaleString()} watching
                </span>
              )}
            </div>

            {/* Title */}
            <h3 className="text-sm font-bold leading-snug text-gray-900">{event.title}</h3>

            {/* Description */}
            {event.description && (
              <p className="mt-0.5 line-clamp-1 text-xs text-gray-400">{event.description}</p>
            )}

            {/* Timestamp */}
            <p className="mt-1 text-[11px] text-gray-400">
              {event.status === "scheduled" && event.scheduled_for &&
                `Scheduled: ${formatDate(event.scheduled_for)}`}
              {event.status === "live" && event.started_at &&
                `Started: ${formatDate(event.started_at)}`}
              {event.status === "ended" && event.ended_at &&
                `Ended: ${formatDate(event.ended_at)}`}
              {!event.scheduled_for && !event.started_at && !event.ended_at &&
                `Created: ${formatDate(event.created_at)}`}
            </p>
          </div>

          {/* Action buttons — stacked vertically */}
          <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
            {event.status === "scheduled" && (
              <>
                <button
                  onClick={() => void goLive()}
                  disabled={working}
                  className="flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-600 disabled:opacity-60"
                >
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  {working ? "Starting…" : "Go Live"}
                </button>
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  {expanded ? "Hide Setup" : "OBS Setup"}
                </button>
                <button
                  onClick={() => void cancelEvent()}
                  disabled={working}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 disabled:opacity-60"
                >
                  Cancel
                </button>
              </>
            )}

            {event.status === "live" && (
              <>
                <button
                  onClick={() => router.push(`/live/${event.id}`)}
                  className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-600"
                >
                  Watch Live
                </button>
                <button
                  onClick={() => void endStream()}
                  disabled={working}
                  className="rounded-full bg-gray-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-gray-900 disabled:opacity-60"
                >
                  {working ? "Ending…" : "End Stream"}
                </button>
              </>
            )}

            {event.status === "ended" && (
              <button
                onClick={() => router.push(`/live/${event.id}`)}
                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Watch Replay
              </button>
            )}
          </div>
        </div>

        {error && (
          <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
            {error}
          </p>
        )}
      </div>

      {/* OBS setup panel — expandable, only for scheduled events */}
      {expanded && event.status === "scheduled" && (
        <div className="space-y-3 border-t border-gray-100 bg-gray-50 px-4 py-3 text-xs">
          <p className="font-semibold text-gray-700">OBS / Encoder Setup</p>

          {/* Server URL */}
          <div className="space-y-1">
            <p className="font-medium text-gray-500">Server URL</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-hidden text-ellipsis rounded-lg border border-gray-200 bg-white px-2 py-1.5 font-mono text-[11px] text-gray-800">
                {RTMP_SERVER}
              </code>
              <button
                onClick={() => void copyToClipboard(RTMP_SERVER, "server")}
                className="flex-shrink-0 rounded-lg bg-gray-200 px-2.5 py-1.5 text-[11px] font-semibold text-gray-600 hover:bg-gray-300"
              >
                {copied === "server" ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          {/* Stream Key */}
          <div className="space-y-1">
            <p className="font-medium text-gray-500">Stream Key</p>
            {event.stream_key ? (
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-hidden text-ellipsis rounded-lg border border-gray-200 bg-white px-2 py-1.5 font-mono text-[11px] text-gray-800">
                  {showKey ? event.stream_key : "●".repeat(24)}
                </code>
                <button
                  onClick={() => setShowKey((v) => !v)}
                  className="flex-shrink-0 rounded-lg bg-gray-200 px-2.5 py-1.5 text-[11px] font-semibold text-gray-600 hover:bg-gray-300"
                >
                  {showKey ? "Hide" : "Show"}
                </button>
                <button
                  onClick={() => void copyToClipboard(event.stream_key!, "key")}
                  className="flex-shrink-0 rounded-lg bg-gray-200 px-2.5 py-1.5 text-[11px] font-semibold text-gray-600 hover:bg-gray-300"
                >
                  {copied === "key" ? "Copied!" : "Copy"}
                </button>
              </div>
            ) : (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
                Stream key not available. Create a new stream via TheBride to get a key.
              </p>
            )}
          </div>

          {/* Playback URL readiness */}
          <div className="flex items-center justify-between border-t border-gray-100 pt-2">
            <span className="text-gray-500">Playback URL</span>
            {event.hls_url ? (
              <span className="font-medium text-green-600">✓ Ready</span>
            ) : (
              <span className="font-medium text-amber-600">Not set</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ManageLivePage() {
  const params  = useParams();
  const router  = useRouter();
  const churchId = params.id as string;

  const [events, setEvents]         = useState<LiveEvent[]>([]);
  const [loading, setLoading]       = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [token, setToken]           = useState("");

  useEffect(() => {
    if (!churchId) return;
    let mounted = true;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      // Verify admin of this specific church
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, church_id")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!mounted) return;

      if (profile?.role !== "church_admin" || profile?.church_id !== churchId) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      setToken(session.access_token);

      // Load all active events for this church (exclude cancelled)
      const { data } = await supabase
        .from("church_live_events")
        .select(MANAGE_COLS)
        .eq("church_id", churchId)
        .in("status", ["scheduled", "live", "ended"])
        .order("created_at", { ascending: false })
        .limit(50);

      if (!mounted) return;
      setEvents((data ?? []) as LiveEvent[]);
      setLoading(false);
    })();

    return () => { mounted = false; };
  }, [churchId, router]);

  const handleUpdated = (id: string, updates: Partial<LiveEvent>) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updates } : e))
    );
  };

  const handleRemoved = (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  const liveNow   = events.filter((e) => e.status === "live");
  const scheduled = events.filter((e) => e.status === "scheduled");
  const replays   = events.filter((e) => e.status === "ended");

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
      </div>
    );
  }

  // ── Access denied ────────────────────────────────────────────────────────────

  if (accessDenied) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-50">
        <span className="text-4xl">🔒</span>
        <p className="text-lg font-bold text-gray-900">Access denied</p>
        <p className="text-sm text-gray-500">Only church admins can manage live streams.</p>
        <button
          onClick={() => router.back()}
          className="rounded-full bg-amber-400 px-5 py-2 text-sm font-bold text-white hover:bg-amber-500"
        >
          Go Back
        </button>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
              aria-label="Back"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Manage Live</h1>
              <p className="text-xs text-gray-400">Schedule, go live, and manage replays</p>
            </div>
          </div>
          <button
            onClick={() => router.push(`/live/create?church=${churchId}`)}
            className="flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1.5 text-sm font-bold text-white shadow hover:bg-red-600"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Schedule
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-6 space-y-8">

        {/* ── Live Now ── */}
        {liveNow.length > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-gray-900">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
              Live Now
              <span className="ml-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
                {liveNow.length}
              </span>
            </h2>
            <div className="space-y-3">
              {liveNow.map((ev) => (
                <EventRow
                  key={ev.id}
                  event={ev}
                  token={token}
                  onUpdated={handleUpdated}
                  onRemoved={handleRemoved}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Scheduled ── */}
        {scheduled.length > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-gray-900">
              <span>📅</span>
              Scheduled
              <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
                {scheduled.length}
              </span>
            </h2>
            <div className="space-y-3">
              {scheduled.map((ev) => (
                <EventRow
                  key={ev.id}
                  event={ev}
                  token={token}
                  onUpdated={handleUpdated}
                  onRemoved={handleRemoved}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Replays ── */}
        {replays.length > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-gray-900">
              <span>🎬</span>
              Replays
              <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
                {replays.length}
              </span>
            </h2>
            <div className="space-y-3">
              {replays.map((ev) => (
                <EventRow
                  key={ev.id}
                  event={ev}
                  token={token}
                  onUpdated={handleUpdated}
                  onRemoved={handleRemoved}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Empty state ── */}
        {events.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-5xl">📡</span>
            <p className="mt-4 text-lg font-bold text-gray-900">No live streams yet</p>
            <p className="mt-1 text-sm text-gray-500">
              Schedule your first stream to get started.
            </p>
            <button
              onClick={() => router.push(`/live/create?church=${churchId}`)}
              className="mt-5 rounded-full bg-red-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-600"
            >
              Schedule a Stream
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
