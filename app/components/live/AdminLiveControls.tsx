"use client";

import { useState } from "react";
import { supabase } from "../../../lib/supabase";
import type { LiveEvent } from "../../../lib/types";

type AdminLiveControlsProps = {
  event: LiveEvent;
  onEventUpdated: (updated: LiveEvent) => void;
};

export default function AdminLiveControls({ event, onEventUpdated }: AdminLiveControlsProps) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStreamKey, setShowStreamKey] = useState(false);

  const update = async (patch: Partial<LiveEvent>) => {
    setWorking(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("church_live_events")
      .update(patch)
      .eq("id", event.id)
      .select()
      .single();
    setWorking(false);
    if (err) { setError(err.message); return; }
    onEventUpdated(data as LiveEvent);
  };

  const goLive = async () => {
    if (!event.hls_url) {
      setError("HLS URL is required before going live. Set it in the stream settings.");
      return;
    }
    const now = new Date().toISOString();
    await update({ status: "live", started_at: now });

    // Notify church followers
    try {
      await fetch("/api/live/notify-followers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          live_event_id: event.id,
          church_id: event.church_id,
          notification_type: "church_live_started",
        }),
      });
    } catch {
      // non-blocking
    }
  };

  const endStream = async () => {
    const now = new Date().toISOString();
    await update({ status: "ended", ended_at: now });
  };

  const cancelEvent = async () => {
    await update({ status: "cancelled" });
  };

  const statusColors: Record<string, string> = {
    scheduled: "bg-amber-100 text-amber-700",
    live: "bg-red-100 text-red-700",
    ended: "bg-gray-100 text-gray-600",
    cancelled: "bg-gray-100 text-gray-400",
  };

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">Stream Controls</h3>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${statusColors[event.status] ?? "bg-gray-100 text-gray-600"}`}>
          {event.status}
        </span>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600 font-medium">{error}</p>
      )}

      {/* Stream key / HLS info */}
      <div className="space-y-2 rounded-xl bg-white p-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-gray-500 font-medium">Stream Input ID</span>
          <span className="font-mono text-gray-800 max-w-[160px] truncate">
            {event.stream_input_id ?? <span className="text-gray-400">Not set</span>}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500 font-medium">HLS URL</span>
          {event.hls_url ? (
            <button
              onClick={() => setShowStreamKey((v) => !v)}
              className="text-amber-600 underline font-medium"
            >
              {showStreamKey ? "Hide" : "Show"}
            </button>
          ) : (
            <span className="text-gray-400">Not set</span>
          )}
        </div>
        {showStreamKey && event.hls_url && (
          <p className="break-all rounded-lg bg-gray-50 p-2 font-mono text-[10px] text-gray-700 select-all">
            {event.hls_url}
          </p>
        )}
      </div>

      {/* Action buttons */}
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

      {/* Future: sermon clipping, moderation, analytics — Phase 2 */}
    </div>
  );
}
