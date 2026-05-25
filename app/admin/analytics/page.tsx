"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { useLanguage } from "../../../lib/useLanguage";

/* ── Types ──────────────────────────────────────────────────────────────── */

type DailyActive  = { date: string; count: number };
type EventTypeStat = { event_type: string; count: number };
type RouteStat    = { route: string; count: number };
type ChurchStat   = { church_id: string; church_name: string | null; count: number };
type RecentEvent  = {
  id: string;
  event_type: string;
  route: string | null;
  platform: string | null;
  created_at: string;
  user_name: string | null;
};

type AnalyticsData = {
  daily_active:       DailyActive[]   | null;
  by_event_type:      EventTypeStat[] | null;
  top_routes:         RouteStat[]     | null;
  church_engagement:  ChurchStat[]    | null;
  recent_events:      RecentEvent[]   | null;
};

/* ── Helpers ────────────────────────────────────────────────────────────── */

const EVENT_COLOR: Record<string, string> = {
  login:                  "bg-brand-100 text-brand-700",
  post_create:            "bg-violet-100 text-violet-700",
  post_like:              "bg-pink-100 text-pink-700",
  comment_create:         "bg-indigo-100 text-indigo-700",
  message_send:           "bg-sky-100 text-sky-700",
  follow_user:            "bg-teal-100 text-teal-700",
  follow_church:          "bg-emerald-100 text-emerald-700",
  donation_completed:     "bg-amber-100 text-amber-700",
  live_start:             "bg-red-100 text-red-700",
  live_join:              "bg-rose-100 text-rose-700",
  support_ticket_created: "bg-orange-100 text-orange-700",
};

function eventBadge(type: string) {
  const cls = EVENT_COLOR[type] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {type}
    </span>
  );
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

/* ── Mini bar chart ─────────────────────────────────────────────────────── */
function BarChart({ data, labelKey, valueKey, color }: {
  data: Record<string, unknown>[];
  labelKey: string;
  valueKey: string;
  color: string;
}) {
  if (!data.length) return <p className="text-sm text-gray-400">No data</p>;
  const max = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);
  return (
    <div className="space-y-2">
      {data.map((row, i) => {
        const pct = Math.round((Number(row[valueKey]) / max) * 100);
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-xs text-gray-500" title={String(row[labelKey])}>
              {String(row[labelKey])}
            </span>
            <div className="flex-1 rounded-full bg-gray-100 h-2">
              <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="w-8 shrink-0 text-right text-xs font-semibold text-gray-700">
              {Number(row[valueKey])}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────────────── */

const DAY_OPTIONS = [7, 14, 30];

export default function AdminAnalyticsPage() {
  const { lang } = useLanguage();
  const isFr = lang === "fr";

  const [days, setDays]       = useState(7);
  const [data, setData]       = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    (async () => {
      const { data: result, error: rpcErr } = await supabase.rpc("admin_get_analytics", { p_days: days });
      if (rpcErr) {
        setError(rpcErr.message);
      } else {
        setData(result as AnalyticsData);
      }
      setLoading(false);
    })();
  }, [days]);

  const daily   = data?.daily_active      ?? [];
  const byType  = data?.by_event_type     ?? [];
  const routes  = data?.top_routes        ?? [];
  const churches = data?.church_engagement ?? [];
  const recent  = data?.recent_events     ?? [];

  /* DAU sparkline — find the max for the bar heights */
  const maxDau = Math.max(...daily.map((d) => d.count), 1);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isFr ? "Analytiques" : "Analytics"}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {isFr
              ? "Activité de la plateforme basée sur les événements instrumentés"
              : "Platform activity based on instrumented events"}
          </p>
        </div>
        {/* Period selector */}
        <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1">
          {DAY_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                days === d
                  ? "bg-amber-500 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {d}{isFr ? "j" : "d"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">
          {error}
          {error.includes("does not exist") && (
            <p className="mt-2 font-medium">
              Run <code className="rounded bg-red-100 px-1">supabase-analytics-events.sql</code> in your Supabase SQL editor first.
            </p>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── 1. Daily Active Users ─────────────────────────────────── */}
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-gray-900">
              {isFr ? "Utilisateurs actifs quotidiens" : "Daily Active Users"}
              <span className="ml-2 text-sm font-normal text-gray-400">({days}{isFr ? " jours" : " days"})</span>
            </h2>
            {daily.length === 0 ? (
              <p className="text-sm text-gray-400">
                {isFr
                  ? "Aucune donnée — commencez à utiliser l'app pour voir l'activité."
                  : "No data yet — start using the app to see activity here."}
              </p>
            ) : (
              <div className="flex h-32 items-end gap-1">
                {daily.map((d) => (
                  <div key={d.date} className="group relative flex flex-1 flex-col items-center">
                    <div
                      className="w-full rounded-t-sm bg-amber-400 transition-all group-hover:bg-amber-500"
                      style={{ height: `${Math.round((d.count / maxDau) * 100)}%`, minHeight: 2 }}
                    />
                    <span className="mt-1 text-[10px] text-gray-400 rotate-45 origin-left hidden sm:block">
                      {fmtDate(d.date)}
                    </span>
                    {/* Tooltip */}
                    <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-1.5 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100">
                      {d.count} · {fmtDate(d.date)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── 2 + 3. Feature Usage & Top Routes ─────────────────────── */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-gray-900">
                {isFr ? "Utilisation par fonctionnalité" : "Feature Usage"}
              </h2>
              <BarChart
                data={byType as Record<string, unknown>[]}
                labelKey="event_type"
                valueKey="count"
                color="bg-brand-400"
              />
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-base font-semibold text-gray-900">
                {isFr ? "Routes les plus visitées" : "Top Routes"}
              </h2>
              <BarChart
                data={routes as Record<string, unknown>[]}
                labelKey="route"
                valueKey="count"
                color="bg-violet-400"
              />
            </div>
          </div>

          {/* ── 4. Church Engagement ──────────────────────────────────── */}
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-gray-900">
              {isFr ? "Engagement par église" : "Church Engagement"}
            </h2>
            {churches.length === 0 ? (
              <p className="text-sm text-gray-400">
                {isFr ? "Aucune activité liée à une église sur cette période." : "No church-linked activity in this period."}
              </p>
            ) : (
              <BarChart
                data={churches as Record<string, unknown>[]}
                labelKey="church_name"
                valueKey="count"
                color="bg-emerald-400"
              />
            )}
          </div>

          {/* ── 5. Recent Events feed ─────────────────────────────────── */}
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-gray-900">
              {isFr ? "Événements récents" : "Recent Events"}
              <span className="ml-2 text-sm font-normal text-gray-400">(last 50)</span>
            </h2>
            {recent.length === 0 ? (
              <p className="text-sm text-gray-400">
                {isFr ? "Aucun événement enregistré." : "No events recorded yet."}
              </p>
            ) : (
              <div className="divide-y divide-gray-50">
                {recent.map((ev) => (
                  <div key={ev.id} className="flex items-center gap-3 py-2">
                    {eventBadge(ev.event_type)}
                    <span className="flex-1 min-w-0 truncate text-xs text-gray-500" title={ev.route ?? ""}>
                      {ev.route ?? "—"}
                    </span>
                    <span className="shrink-0 text-xs text-gray-400">{ev.platform ?? "web"}</span>
                    <span className="shrink-0 text-xs text-gray-400">
                      {fmtDate(ev.created_at)} {fmtTime(ev.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Note about external analytics ────────────────────────── */}
          <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center">
            <p className="text-sm text-gray-500">
              {isFr
                ? "Pour des analyses avancées, consultez "
                : "For advanced analytics, see "}
              <code className="rounded bg-gray-100 px-1 text-xs">docs/ANALYTICS_SETUP.md</code>
              {isFr
                ? " pour configurer Vercel Analytics, Sentry et Clarity."
                : " for Vercel Analytics, Sentry, and Clarity setup."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
