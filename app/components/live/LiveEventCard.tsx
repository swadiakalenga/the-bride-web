"use client";

import { useRouter } from "next/navigation";
import type { LiveEvent } from "../../../lib/types";

type LiveEventCardProps = {
  event: LiveEvent;
  variant?: "live" | "scheduled" | "replay";
};

function formatScheduled(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) +
    " · " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(startedAt: string | null, endedAt: string | null) {
  if (!startedAt || !endedAt) return null;
  const mins = Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function LiveEventCard({ event, variant }: LiveEventCardProps) {
  const router = useRouter();
  const resolvedVariant = variant ?? (
    event.status === "live" ? "live" :
    event.status === "scheduled" ? "scheduled" :
    "replay"
  );

  const duration = formatDuration(event.started_at, event.ended_at);

  return (
    <button
      onClick={() => router.push(`/live/${event.id}`)}
      className="group w-full overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-gray-100 transition hover:shadow-md hover:-translate-y-0.5"
    >
      {/* Thumbnail */}
      <div className="relative overflow-hidden" style={{ aspectRatio: "16/9" }}>
        {event.thumbnail_url ? (
          <img
            src={event.thumbnail_url}
            alt={event.title}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
            <span className="text-4xl opacity-30">📡</span>
          </div>
        )}

        {/* Status badge */}
        <div className="absolute left-2.5 top-2.5">
          {resolvedVariant === "live" && (
            <span className="flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              Live
            </span>
          )}
          {resolvedVariant === "scheduled" && (
            <span className="rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow">
              Upcoming
            </span>
          )}
          {resolvedVariant === "replay" && (
            <span className="rounded-full bg-gray-700 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow">
              Replay
            </span>
          )}
        </div>

        {/* Viewer count (live only) */}
        {resolvedVariant === "live" && event.viewer_count > 0 && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
            </svg>
            {event.viewer_count.toLocaleString()}
          </div>
        )}

        {/* Duration (replay only) */}
        {resolvedVariant === "replay" && duration && (
          <div className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">
            {duration}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          {event.church_avatar ? (
            <img src={event.church_avatar} alt="" className="h-7 w-7 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-[11px] font-bold text-white">
              {(event.church_name || "C").charAt(0).toUpperCase()}
            </div>
          )}
          <span className="truncate text-xs text-gray-500">{event.church_name || "Church"}</span>
        </div>

        <p className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-gray-900">
          {event.title}
        </p>

        {resolvedVariant === "scheduled" && event.scheduled_for && (
          <p className="mt-1 text-[11px] text-amber-600 font-medium">
            📅 {formatScheduled(event.scheduled_for)}
          </p>
        )}
      </div>
    </button>
  );
}
