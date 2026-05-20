"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../../lib/supabase";
import { useLanguage } from "../../../lib/useLanguage";

type ReportRow = {
  id: string;
  reporter_id: string;
  reporter_name: string | null;
  target_type: string;
  target_id: string;
  reason: string;
  status: string;
  created_at: string;
};

const FILTERS = ["pending", "all"] as const;
type Filter = (typeof FILTERS)[number];

export default function AdminReportsPage() {
  const { t } = useLanguage();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("pending");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: rpcError } = await supabase.rpc("admin_list_reports", {
      p_status: filter,
      p_limit: 100,
    });
    if (rpcError) setError(rpcError.message);
    else setReports((data as ReportRow[]) ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const update = async (id: string, status: "reviewed" | "resolved" | "dismissed") => {
    setSavingId(id);
    const { error: rpcError } = await supabase.rpc("admin_update_report", {
      p_report_id: id,
      p_status: status,
      p_notes: notesMap[id] ?? null,
    });
    if (rpcError) setError(rpcError.message);
    else await load();
    setSavingId(null);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">{t("admin_reports_title")}</h1>

      {/* Filter pills */}
      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === f ? "bg-amber-500 text-white" : "bg-white text-gray-500 shadow-sm hover:bg-gray-50"
            }`}
          >
            {f === "pending" ? t("admin_reports_filter_pending") : t("admin_reports_filter_all")}
          </button>
        ))}
      </div>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-gray-400">{t("admin_reports_none")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="rounded-2xl bg-white p-4 shadow-sm space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {t("admin_reports_reporter")}: {r.reporter_name ?? r.reporter_id}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t("admin_reports_target_type")}: <strong>{r.target_type}</strong> ·{" "}
                    {t("admin_reports_reason")}: {r.reason}
                  </p>
                  <p className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  r.status === "pending" ? "bg-amber-100 text-amber-700"
                  : r.status === "resolved" ? "bg-emerald-100 text-emerald-700"
                  : r.status === "dismissed" ? "bg-gray-100 text-gray-500"
                  : "bg-blue-100 text-blue-700"
                }`}>
                  {r.status}
                </span>
              </div>

              {r.status === "pending" && (
                <>
                  <textarea
                    rows={1}
                    placeholder={t("admin_reports_notes")}
                    value={notesMap[r.id] ?? ""}
                    onChange={(e) => setNotesMap((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs outline-none focus:border-amber-400 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      disabled={savingId === r.id}
                      onClick={() => update(r.id, "reviewed")}
                      className="rounded-lg bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-200 disabled:opacity-50"
                    >
                      {t("admin_reports_reviewed")}
                    </button>
                    <button
                      disabled={savingId === r.id}
                      onClick={() => update(r.id, "resolved")}
                      className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 disabled:opacity-50"
                    >
                      {t("admin_reports_resolve")}
                    </button>
                    <button
                      disabled={savingId === r.id}
                      onClick={() => update(r.id, "dismissed")}
                      className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200 disabled:opacity-50"
                    >
                      {t("admin_reports_dismiss")}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
