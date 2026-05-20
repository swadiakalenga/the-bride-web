"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useLanguage } from "../../lib/useLanguage";

type Stats = {
  total_users: number;
  total_churches: number;
  pending_verifications: number;
  total_posts: number;
  total_messages: number;
  pending_reports: number;
  total_reports: number;
};

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

export default function AdminOverviewPage() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error: rpcError } = await supabase.rpc("admin_get_stats");
      if (rpcError) { setError(rpcError.message); }
      else { setStats(data as Stats); }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return <p className="rounded-xl bg-red-50 p-4 text-red-600 text-sm">{error}</p>;
  }

  const statItems = stats
    ? [
        { label: t("admin_stat_users"), value: stats.total_users, color: "text-brand-600" },
        { label: t("admin_stat_churches"), value: stats.total_churches, color: "text-emerald-600" },
        { label: t("admin_stat_verif_pending"), value: stats.pending_verifications, color: "text-amber-600" },
        { label: t("admin_stat_posts"), value: stats.total_posts, color: "text-gray-900" },
        { label: t("admin_stat_messages"), value: stats.total_messages, color: "text-gray-900" },
        { label: t("admin_stat_reports_pending"), value: stats.pending_reports, color: "text-red-600" },
        { label: t("admin_stat_reports_total"), value: stats.total_reports, color: "text-gray-900" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t("admin_title")}</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {statItems.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} color={s.color} />
        ))}
      </div>
    </div>
  );
}
