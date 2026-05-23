"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../../lib/supabase";
import type { LiveEvent } from "../../../../../lib/types";

const RTMP_SERVER = "rtmps://global-live.mux.com:443/app";

const EVENT_COLS = `
  id, church_id, created_by, title, description, thumbnail_url,
  scheduled_for, started_at, ended_at, status,
  stream_input_id, hls_url, playback_url, playback_id, stream_key, provider,
  viewer_count, replay_enabled, created_at
`;

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return (
    d.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " · " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}

// ── OBS Setup Panel ───────────────────────────────────────────────────────────

function ObsPanel({ streamKey }: { streamKey?: string | null }) {
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState<"server" | "key" | null>(null);

  const copy = async (text: string, type: "server" | "key") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2200);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <div className="rounded-xl bg-gray-900 p-4 space-y-3 text-xs">
      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
        OBS / Encoder Setup
      </p>

      {/* Server URL */}
      <div className="space-y-1">
        <p className="text-gray-500">Server URL</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-lg bg-black/40 px-3 py-2 font-mono text-[11px] text-green-400">
            {RTMP_SERVER}
          </code>
          <button
            onClick={() => void copy(RTMP_SERVER, "server")}
            className="flex-shrink-0 rounded-lg bg-gray-700 px-2.5 py-2 text-[11px] font-semibold text-gray-300 hover:bg-gray-600 transition"
          >
            {copied === "server" ? "✓ Copied" : "Copy"}
          </button>
        </div>
      </div>

      {/* Stream Key */}
      <div className="space-y-1">
        <p className="text-gray-500">Stream Key</p>
        {streamKey ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-black/40 px-3 py-2 font-mono text-[11px] text-green-400">
              {showKey ? streamKey : "●".repeat(28)}
            </code>
            <button
              onClick={() => setShowKey((v) => !v)}
              className="flex-shrink-0 rounded-lg bg-gray-700 px-2.5 py-2 text-[11px] font-semibold text-gray-300 hover:bg-gray-600 transition"
            >
              {showKey ? "Hide" : "Show"}
            </button>
            <button
              onClick={() => void copy(streamKey, "key")}
              className="flex-shrink-0 rounded-lg bg-gray-700 px-2.5 py-2 text-[11px] font-semibold text-gray-300 hover:bg-gray-600 transition"
            >
              {copied === "key" ? "✓ Copied" : "Copy"}
            </button>
          </div>
        ) : (
          <p className="rounded-lg border border-amber-700/40 bg-amber-900/20 px-3 py-2 text-amber-400">
            Stream key not available.
          </p>
        )}
      </div>

      <p className="text-gray-600">
        Paste into OBS → Settings → Stream → Custom. Start streaming in OBS, then viewers can watch live.
      </p>
    </div>
  );
}

// ── Event Row ─────────────────────────────────────────────────────────────────

type EventRowProps = {
  event: LiveEvent;
  token: string;
  obsExpanded: boolean;
  onToggleObs: () => void;
  onUpdated: (id: string, updates: Partial<LiveEvent>) => void;
  onRemoved: (id: string) => void;
};

function EventRow({
  event,
  token,
  obsExpanded,
  onToggleObs,
  onUpdated,
  onRemoved,
}: EventRowProps) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function callApi(path: string): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ eventId: event.id }),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    return res.ok ? { ok: true } : { ok: false, error: json.error ?? "Request failed" };
  }

  const goLive = async () => {
    setWorking(true);
    setError(null);
    const result = await callApi("/api/live/start");
    setWorking(false);
    if (!result.ok) { setError(result.error ?? "Failed to go live"); return; }
    onUpdated(event.id, { status: "live", started_at: new Date().toISOString() });
    // Auto-show OBS panel so admin can connect OBS immediately
    if (!obsExpanded) onToggleObs();
  };

  const endStream = async () => {
    if (!confirm("End this stream? It will be saved as a replay.")) return;
    setWorking(true);
    setError(null);
    const result = await callApi("/api/live/end");
    setWorking(false);
    if (!result.ok) { setError(result.error ?? "Failed to end stream"); return; }
    onUpdated(event.id, { status: "ended", ended_at: new Date().toISOString() });
  };

  const cancelEvent = async () => {
    if (!confirm("Cancel this scheduled stream?")) return;
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

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold leading-snug text-gray-900">{event.title}</p>
            {event.description && (
              <p className="mt-0.5 line-clamp-1 text-xs text-gray-400">{event.description}</p>
            )}
            <p className="mt-1 text-[11px] text-gray-400">
              {event.status === "scheduled" && event.scheduled_for
                ? `Scheduled: ${formatDate(event.scheduled_for)}`
                : event.status === "live" && event.started_at
                ? `Started: ${formatDate(event.started_at)}`
                : event.status === "ended" && event.ended_at
                ? `Ended: ${formatDate(event.ended_at)}`
                : `Created: ${formatDate(event.created_at)}`}
            </p>
          </div>

          {/* Actions */}
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
                  onClick={onToggleObs}
                  className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  {obsExpanded ? "Hide OBS" : "OBS Setup"}
                </button>
                <button
                  onClick={() => void cancelEvent()}
                  disabled={working}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-50 disabled:opacity-60"
                >
                  Cancel
                </button>
              </>
            )}

            {event.status === "live" && (
              <>
                <button
                  onClick={onToggleObs}
                  className="rounded-full bg-gray-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-gray-800"
                >
                  {obsExpanded ? "Hide OBS" : "OBS Setup"}
                </button>
                <button
                  onClick={() => router.push(`/live/${event.id}`)}
                  className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100"
                >
                  Watch Live
                </button>
                <button
                  onClick={() => void endStream()}
                  disabled={working}
                  className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                >
                  {working ? "Ending…" : "End Stream"}
                </button>
              </>
            )}

            {event.status === "ended" && (
              <button
                onClick={() => router.push(`/live/${event.id}`)}
                className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
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

      {/* OBS panel — visible for scheduled and live, toggled by button */}
      {obsExpanded && (event.status === "scheduled" || event.status === "live") && (
        <div className="border-t border-gray-100 p-4">
          <ObsPanel streamKey={event.stream_key} />
        </div>
      )}
    </div>
  );
}

// ── Go Live Modal ─────────────────────────────────────────────────────────────

type ModalProps = {
  churchId: string;
  token: string;
  onClose: () => void;
  onCreated: (event: LiveEvent, mode: "now" | "schedule") => void;
};

function GoLiveModal({ churchId, token, onClose, onCreated }: ModalProps) {
  const [tab, setTab] = useState<"now" | "schedule">("now");

  // Go Live Now
  const [nowTitle, setNowTitle] = useState("");

  // Schedule Live
  const [schedTitle, setSchedTitle] = useState("");
  const [schedDesc, setSchedDesc]   = useState("");
  const [schedFor, setSchedFor]     = useState("");

  const [working, setWorking] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function fetchEvent(eventId: string): Promise<LiveEvent | null> {
    const { data } = await supabase
      .from("church_live_events")
      .select(EVENT_COLS)
      .eq("id", eventId)
      .maybeSingle();
    return data as LiveEvent | null;
  }

  const handleGoLiveNow = async () => {
    if (!nowTitle.trim()) return;
    setWorking(true);
    setError(null);

    // 1. Create Mux stream + DB row (status = scheduled)
    const createRes = await fetch("/api/live/create-mux-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ churchId, title: nowTitle.trim() }),
    });
    const createJson = (await createRes.json()) as { eventId?: string; error?: string };

    if (!createRes.ok || !createJson.eventId) {
      setError(createJson.error ?? "Failed to create stream. Check Mux env vars.");
      setWorking(false);
      return;
    }

    // 2. Set live immediately — this also fires push notifications to followers
    const startRes = await fetch("/api/live/start", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ eventId: createJson.eventId }),
    });
    const startJson = (await startRes.json()) as { ok?: boolean; error?: string };

    if (!startRes.ok) {
      setError(startJson.error ?? "Stream created but failed to go live.");
      setWorking(false);
      return;
    }

    const event = await fetchEvent(createJson.eventId);
    setWorking(false);
    if (event) onCreated(event, "now");
  };

  const handleSchedule = async () => {
    if (!schedTitle.trim()) return;
    setWorking(true);
    setError(null);

    const body: Record<string, string> = { churchId, title: schedTitle.trim() };
    if (schedDesc.trim()) body.description = schedDesc.trim();
    if (schedFor)         body.scheduledFor = schedFor;

    // Create stream with status = scheduled — NO notification (correct per spec)
    const createRes = await fetch("/api/live/create-mux-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const createJson = (await createRes.json()) as { eventId?: string; error?: string };

    if (!createRes.ok || !createJson.eventId) {
      setError(createJson.error ?? "Failed to schedule stream. Check Mux env vars.");
      setWorking(false);
      return;
    }

    const event = await fetchEvent(createJson.eventId);
    setWorking(false);
    if (event) onCreated(event, "schedule");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-bold text-gray-900">Go Live</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => { setTab("now"); setError(null); }}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              tab === "now"
                ? "border-b-2 border-red-500 text-red-600"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Go Live Now
          </button>
          <button
            onClick={() => { setTab("schedule"); setError(null); }}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              tab === "schedule"
                ? "border-b-2 border-amber-500 text-amber-600"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Schedule Live
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
          )}

          {/* ── Go Live Now ── */}
          {tab === "now" && (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Stream title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={nowTitle}
                  onChange={(e) => setNowTitle(e.target.value)}
                  placeholder="e.g. Sunday Morning Service"
                  autoFocus
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-100"
                />
              </div>

              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700 space-y-1">
                <p className="font-semibold">Going live immediately</p>
                <p>A Mux stream key is generated. Paste it into OBS to start broadcasting.</p>
                <p>Your followers will receive a push notification.</p>
              </div>

              <button
                onClick={() => void handleGoLiveNow()}
                disabled={working || !nowTitle.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 py-3.5 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50 transition"
              >
                {working ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Creating stream…
                  </>
                ) : (
                  <>
                    <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                    Create &amp; Go Live
                  </>
                )}
              </button>
            </>
          )}

          {/* ── Schedule Live ── */}
          {tab === "schedule" && (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Stream title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={schedTitle}
                  onChange={(e) => setSchedTitle(e.target.value)}
                  placeholder="e.g. Wednesday Prayer Service"
                  autoFocus
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Description{" "}
                  <span className="text-xs font-normal text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={schedDesc}
                  onChange={(e) => setSchedDesc(e.target.value)}
                  placeholder="What will you be streaming about?"
                  rows={2}
                  className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Scheduled date &amp; time{" "}
                  <span className="text-xs font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  type="datetime-local"
                  value={schedFor}
                  onChange={(e) => setSchedFor(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
                />
              </div>

              <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-700 space-y-1">
                <p className="font-semibold">Scheduling a stream</p>
                <p>The stream key is created now so OBS can be configured in advance.</p>
                <p>Followers are not notified until you press Go Live.</p>
              </div>

              <button
                onClick={() => void handleSchedule()}
                disabled={working || !schedTitle.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3.5 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50 transition"
              >
                {working ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Scheduling…
                  </>
                ) : (
                  "Schedule Live"
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ManageLivePage() {
  const params   = useParams();
  const router   = useRouter();
  const churchId = params.id as string;

  const [events, setEvents]           = useState<LiveEvent[]>([]);
  const [churchName, setChurchName]   = useState("");
  const [loading, setLoading]         = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [token, setToken]             = useState("");
  const [showModal, setShowModal]     = useState(false);
  const [obsExpandedId, setObsExpandedId] = useState<string | null>(null);

  const toggleObs = useCallback((id: string) => {
    setObsExpandedId((prev) => (prev === id ? null : id));
  }, []);

  useEffect(() => {
    if (!churchId) return;
    let mounted = true;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      const [{ data: profile }, { data: church }] = await Promise.all([
        supabase.from("profiles").select("role, church_id").eq("id", session.user.id).maybeSingle(),
        supabase.from("churches").select("name").eq("id", churchId).maybeSingle(),
      ]);

      if (!mounted) return;

      const isAdmin =
        profile?.role === "church_admin" &&
        profile?.church_id != null &&
        profile.church_id.trim() === churchId.trim();

      if (!isAdmin) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      setToken(session.access_token);
      setChurchName(church?.name ?? "");

      const { data } = await supabase
        .from("church_live_events")
        .select(EVENT_COLS)
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

  const handleUpdated = (id: string, updates: Partial<LiveEvent>) =>
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));

  const handleRemoved = (id: string) =>
    setEvents((prev) => prev.filter((e) => e.id !== id));

  const handleCreated = (event: LiveEvent, mode: "now" | "schedule") => {
    setEvents((prev) => [event, ...prev]);
    setShowModal(false);
    // Auto-expand OBS panel when going live immediately
    if (mode === "now") setObsExpandedId(event.id);
  };

  const liveNow   = events.filter((e) => e.status === "live");
  const scheduled = events.filter((e) => e.status === "scheduled");
  const replays   = events.filter((e) => e.status === "ended");

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
      </div>
    );
  }

  // ── Access denied ─────────────────────────────────────────────────────────────
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

  // ── Dashboard ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="min-h-screen bg-gray-50 pb-24">
        {/* Header */}
        <div className="sticky top-0 z-20 border-b border-gray-200 bg-white px-4 py-3">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <button
              onClick={() => router.push(`/church/${churchId}`)}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
              aria-label="Back to Church"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-gray-900">Manage Live</h1>
              {churchName && (
                <p className="truncate text-xs text-gray-400">{churchName}</p>
              )}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-lg space-y-6 px-4 pt-5">
          {/* ── Primary Go Live button ── */}
          <button
            onClick={() => setShowModal(true)}
            className="relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-red-500 py-5 text-base font-bold text-white shadow-lg shadow-red-200 transition-all hover:bg-red-600 active:scale-[.98]"
          >
            {/* Animated ring */}
            <span className="relative flex h-3.5 w-3.5 flex-shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-50" />
              <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-white opacity-90" />
            </span>
            Go Live
          </button>

          {/* ── Currently Live ── */}
          {liveNow.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                Currently Live
                <span className="ml-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-red-500">
                  {liveNow.length}
                </span>
              </h2>
              <div className="space-y-3">
                {liveNow.map((ev) => (
                  <EventRow
                    key={ev.id}
                    event={ev}
                    token={token}
                    obsExpanded={obsExpandedId === ev.id}
                    onToggleObs={() => toggleObs(ev.id)}
                    onUpdated={handleUpdated}
                    onRemoved={handleRemoved}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Scheduled Lives ── */}
          {scheduled.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                <span>📅</span>
                Scheduled Lives
                <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-gray-500">
                  {scheduled.length}
                </span>
              </h2>
              <div className="space-y-3">
                {scheduled.map((ev) => (
                  <EventRow
                    key={ev.id}
                    event={ev}
                    token={token}
                    obsExpanded={obsExpandedId === ev.id}
                    onToggleObs={() => toggleObs(ev.id)}
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
              <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                <span>🎬</span>
                Replays
                <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-gray-500">
                  {replays.length}
                </span>
              </h2>
              <div className="space-y-3">
                {replays.map((ev) => (
                  <EventRow
                    key={ev.id}
                    event={ev}
                    token={token}
                    obsExpanded={false}
                    onToggleObs={() => {}}
                    onUpdated={handleUpdated}
                    onRemoved={handleRemoved}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Empty state ── */}
          {events.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="text-5xl">📡</span>
              <p className="mt-4 text-base font-bold text-gray-900">No streams yet</p>
              <p className="mt-1 text-sm text-gray-400">
                Tap Go Live above to start your first stream.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Go Live modal */}
      {showModal && (
        <GoLiveModal
          churchId={churchId}
          token={token}
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  );
}
