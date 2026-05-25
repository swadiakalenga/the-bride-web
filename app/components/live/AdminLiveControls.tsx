"use client";

import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import type { LiveEvent } from "../../../lib/types";
import { trackEvent } from "../../../lib/analytics/trackEvent";

const RTMP_SERVER = "rtmps://global-live.mux.com:443/app";

type Props = {
  event: LiveEvent;
  onEventUpdated: (updated: Partial<LiveEvent>) => void;
};

export default function AdminLiveControls({ event, onEventUpdated }: Props) {
  const [working, setWorking]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [showKey, setShowKey]       = useState(false);
  const [copied, setCopied]         = useState<"server" | "key" | null>(null);

  const streamKey = event.stream_key ?? null;
  const isMux     = event.provider === "mux" || !!event.stream_input_id;

  // ── Helpers ────────────────────────────────────────────────────────────────

  async function sessionToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  async function callApi(path: string): Promise<{ ok: boolean; error?: string }> {
    const token = await sessionToken();
    if (!token) return { ok: false, error: "Not logged in" };
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ eventId: event.id }),
    });
    const json = await res.json() as { ok?: boolean; error?: string };
    return res.ok ? { ok: true } : { ok: false, error: json.error ?? "Request failed" };
  }

  const copyToClipboard = async (text: string, type: "server" | "key") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // fallback — silently ignore if clipboard API unavailable
    }
  };

  // ── Actions ────────────────────────────────────────────────────────────────

  const goLive = async () => {
    if (isMux) {
      // Mux flow — call API route
      setWorking(true);
      setError(null);
      const result = await callApi("/api/live/start");
      setWorking(false);
      if (!result.ok) { setError(result.error ?? "Failed to go live"); return; }
      trackEvent("live_start", { entity_type: "live_event", entity_id: event.id, church_id: event.church_id });
      onEventUpdated({ status: "live", started_at: new Date().toISOString() });
    } else {
      // Legacy manual flow — requires hls_url pre-set
      if (!event.hls_url) {
        setError("HLS URL must be set before going live. Update it in Supabase or use the Mux flow.");
        return;
      }
      setWorking(true);
      setError(null);
      const { data, error: err } = await supabase
        .from("church_live_events")
        .update({ status: "live", started_at: new Date().toISOString() })
        .eq("id", event.id)
        .select()
        .single();
      setWorking(false);
      if (err) { setError(err.message); return; }
      trackEvent("live_start", { entity_type: "live_event", entity_id: event.id, church_id: event.church_id });
      onEventUpdated(data as Partial<LiveEvent>);

      // Notify followers
      const token = await sessionToken();
      if (token) {
        fetch("/api/live/notify-followers", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ live_event_id: event.id, church_id: event.church_id, notification_type: "church_live_started" }),
        }).catch(() => {});
      }
    }
  };

  const endStream = async () => {
    setWorking(true);
    setError(null);
    if (isMux) {
      const result = await callApi("/api/live/end");
      setWorking(false);
      if (!result.ok) { setError(result.error ?? "Failed to end stream"); return; }
    } else {
      const { error: err } = await supabase
        .from("church_live_events")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", event.id);
      setWorking(false);
      if (err) { setError(err.message); return; }
    }
    onEventUpdated({ status: "ended", ended_at: new Date().toISOString() });
  };

  const cancelEvent = async () => {
    setWorking(true);
    setError(null);
    const { error: err } = await supabase
      .from("church_live_events")
      .update({ status: "cancelled" })
      .eq("id", event.id);
    setWorking(false);
    if (err) { setError(err.message); return; }
    onEventUpdated({ status: "cancelled" });
  };

  // ── Status badge ────────────────────────────────────────────────────────────
  const statusColors: Record<string, string> = {
    scheduled: "bg-amber-100 text-amber-700",
    live:       "bg-red-100 text-red-700",
    ended:      "bg-gray-100 text-gray-500",
    cancelled:  "bg-gray-100 text-gray-400",
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">Stream Controls</h3>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${statusColors[event.status] ?? "bg-gray-100 text-gray-500"}`}>
          {event.status}
        </span>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600 font-medium">{error}</p>
      )}

      {/* ── Scheduled: show OBS/encoder setup ── */}
      {event.status === "scheduled" && (
        <div className="space-y-2 rounded-xl bg-white border border-gray-100 p-3 text-xs">
          <p className="font-semibold text-gray-700 mb-2">Encoder / OBS Setup</p>

          {/* Server URL */}
          <div className="space-y-1">
            <p className="text-gray-500 font-medium">Server URL</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-hidden text-ellipsis rounded-lg bg-gray-50 px-2 py-1.5 font-mono text-[11px] text-gray-800">
                {RTMP_SERVER}
              </code>
              <button
                onClick={() => copyToClipboard(RTMP_SERVER, "server")}
                className="flex-shrink-0 rounded-lg bg-gray-100 px-2.5 py-1.5 text-[11px] font-semibold text-gray-600 hover:bg-gray-200"
              >
                {copied === "server" ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          {/* Stream Key */}
          <div className="space-y-1">
            <p className="text-gray-500 font-medium">Stream Key</p>
            {streamKey ? (
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-hidden text-ellipsis rounded-lg bg-gray-50 px-2 py-1.5 font-mono text-[11px] text-gray-800">
                  {showKey ? streamKey : "●".repeat(24)}
                </code>
                <button
                  onClick={() => setShowKey((v) => !v)}
                  className="flex-shrink-0 rounded-lg bg-gray-100 px-2.5 py-1.5 text-[11px] font-semibold text-gray-600 hover:bg-gray-200"
                >
                  {showKey ? "Hide" : "Show"}
                </button>
                <button
                  onClick={() => copyToClipboard(streamKey, "key")}
                  className="flex-shrink-0 rounded-lg bg-gray-100 px-2.5 py-1.5 text-[11px] font-semibold text-gray-600 hover:bg-gray-200"
                >
                  {copied === "key" ? "Copied!" : "Copy"}
                </button>
              </div>
            ) : (
              <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-amber-700">
                Stream key not available. This event may have been created manually.
                Set the HLS URL in Supabase or create a new stream via TheBride.
              </p>
            )}
          </div>

          {/* HLS URL status */}
          <div className="flex items-center justify-between pt-1 border-t border-gray-100">
            <span className="text-gray-500">Playback URL</span>
            {event.hls_url ? (
              <span className="text-green-600 font-medium">✓ Ready</span>
            ) : (
              <span className="text-amber-600 font-medium">Not set</span>
            )}
          </div>
        </div>
      )}

      {/* ── Live: show live indicator ── */}
      {event.status === "live" && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 px-3 py-2.5">
          <span className="h-2.5 w-2.5 flex-shrink-0 animate-pulse rounded-full bg-red-500" />
          <span className="text-sm font-bold text-red-700">You are live now</span>
        </div>
      )}

      {/* ── Action buttons ── */}
      <div className="flex flex-wrap gap-2">
        {event.status === "scheduled" && (
          <>
            <button
              onClick={() => void goLive()}
              disabled={working}
              className="flex items-center gap-1.5 rounded-full bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-60"
            >
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              {working ? "Starting…" : "Go Live"}
            </button>
            <button
              onClick={() => void cancelEvent()}
              disabled={working}
              className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 disabled:opacity-60"
            >
              Cancel
            </button>
          </>
        )}

        {event.status === "live" && (
          <button
            onClick={() => void endStream()}
            disabled={working}
            className="rounded-full bg-gray-800 px-4 py-2 text-sm font-bold text-white hover:bg-gray-900 disabled:opacity-60"
          >
            {working ? "Ending…" : "End Stream"}
          </button>
        )}

        {(event.status === "ended" || event.status === "cancelled") && (
          <p className="text-xs text-gray-500 italic">This stream has ended.</p>
        )}
      </div>
    </div>
  );
}
