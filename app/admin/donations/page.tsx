"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { useLanguage } from "../../../lib/useLanguage";

type Donation = {
  id: string;
  donor_id: string;
  donor_name: string | null;
  target_type: string;
  target_id: string | null;
  give_type: string | null;
  amount: number;
  currency: string;
  method: string;
  status: string;
  reference: string | null;
  note: string | null;
  created_at: string;
};

type Filter = "all" | "pending" | "confirmed";

const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-yellow-100 text-yellow-700",
  confirmed: "bg-green-100 text-green-700",
  rejected:  "bg-red-100 text-red-700",
};

export default function AdminDonationsPage() {
  const { t } = useLanguage();
  const [donations, setDonations]   = useState<Donation[]>([]);
  const [filter, setFilter]         = useState<Filter>("all");
  const [targetFilter, setTargetFilter] = useState<"all" | "platform" | "church">("all");
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [actionId, setActionId]     = useState<string | null>(null);
  const [notes, setNotes]           = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase.rpc("admin_list_all_donations", {
      p_target_type: targetFilter,
      p_status:      filter === "confirmed" ? "confirmed" : filter,
      p_limit:       100,
      p_offset:      0,
    });
    if (err) { setError(err.message); setLoading(false); return; }
    setDonations((data as Donation[]) ?? []);
    setLoading(false);
  }, [filter, targetFilter]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: "confirmed" | "rejected") => {
    setActionId(id);
    const { error: err } = await supabase.rpc("admin_update_donation", {
      p_donation_id: id,
      p_status:      status,
      p_notes:       notes[id] || null,
    });
    setActionId(null);
    if (err) { setError(err.message); return; }
    await load();
  };

  const fmt = (amount: number, currency: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);

  const fmtDate = (d: string) => new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });

  const methodLabel = (m: string) => {
    const map: Record<string, string> = {
      paypal: "PayPal", mobile_money: t("pay_method_mobile"),
      bank: t("pay_method_bank"), stripe: t("pay_method_card"),
    };
    return map[m] ?? m;
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{t("pay_donations_title")}</h1>

        <div className="flex flex-wrap gap-2">
          {/* Target filter */}
          {(["all", "platform", "church"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setTargetFilter(v)}
              className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition ${
                targetFilter === v ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {v === "all" ? t("pay_donations_filter_all") : v}
            </button>
          ))}

          {/* Status filter */}
          {(["all", "pending", "confirmed"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                filter === v ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {v === "all" ? t("pay_donations_filter_all") : v === "pending" ? t("pay_donations_filter_pending") : t("pay_donations_filter_confirmed")}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
        </div>
      ) : donations.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
          <p className="text-gray-400">{t("pay_donations_none")}</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 border-b border-gray-100 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
            <span>{t("pay_donations_donor")}</span>
            <span className="text-right">{t("pay_donations_amount")}</span>
            <span>{t("pay_donations_method")}</span>
            <span>{t("pay_donations_status")}</span>
            <span>{t("pay_donations_date")}</span>
          </div>

          <div className="divide-y divide-gray-50">
            {donations.map((d) => (
              <div key={d.id} className="px-5 py-3 space-y-2">
                {/* Main row */}
                <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-x-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {d.donor_name ?? d.donor_id.slice(0, 8) + "…"}
                    </p>
                    <p className="text-xs text-gray-400 capitalize">
                      {d.target_type}{d.give_type ? ` · ${d.give_type}` : ""}
                      {d.reference ? ` · ${d.reference}` : ""}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-gray-900 whitespace-nowrap">
                    {fmt(d.amount, d.currency)}
                  </span>
                  <span className="text-xs text-gray-500 whitespace-nowrap">{methodLabel(d.method)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[d.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {d.status === "pending" ? t("pay_status_pending") : d.status === "confirmed" ? t("pay_status_confirmed") : t("pay_status_rejected")}
                  </span>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{fmtDate(d.created_at)}</span>
                </div>

                {/* Note */}
                {d.note && (
                  <p className="text-xs text-gray-500 italic pl-0.5">{d.note}</p>
                )}

                {/* Confirm / Reject actions (only for pending) */}
                {d.status === "pending" && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={notes[d.id] ?? ""}
                      onChange={(e) => setNotes((p) => ({ ...p, [d.id]: e.target.value }))}
                      placeholder={t("pay_donations_notes")}
                      className="flex-1 min-w-0 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs outline-none focus:border-amber-400"
                    />
                    <button
                      onClick={() => updateStatus(d.id, "confirmed")}
                      disabled={actionId === d.id}
                      className="rounded-lg bg-green-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-600 disabled:opacity-60"
                    >
                      {t("pay_donations_confirm")}
                    </button>
                    <button
                      onClick={() => updateStatus(d.id, "rejected")}
                      disabled={actionId === d.id}
                      className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-60"
                    >
                      {t("pay_donations_reject")}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
