"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { useLanguage } from "../../../lib/useLanguage";

type PayoutStatus = "not_started" | "pending_review" | "approved" | "rejected";

type PayoutRow = {
  id: string;
  name: string;
  payout_contact_name: string | null;
  payout_contact_email: string | null;
  payout_country: string | null;
  preferred_payout_method: string | null;
  payout_bank_name: string | null;
  payout_account_holder: string | null;
  payout_last4: string | null;
  payout_status: PayoutStatus;
};

export default function AdminPayoutsPage() {
  const { t, lang } = useLanguage();
  const isFr = lang === "fr";

  const [rows, setRows]       = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<PayoutStatus | "all">("pending_review");
  const [actionMsg, setActionMsg] = useState<Record<string, string>>({});

  useEffect(() => { loadData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoading(true);
    const { data } = await supabase
      .from("churches")
      .select("id, name, payout_contact_name, payout_contact_email, payout_country, preferred_payout_method, payout_bank_name, payout_account_holder, payout_last4, payout_status")
      .not("payout_status", "eq", "not_started")
      .order("name");

    setRows((data as PayoutRow[]) ?? []);
    setLoading(false);
  }

  const filtered = filter === "all" ? rows : rows.filter((r) => r.payout_status === filter);

  const updateStatus = async (churchId: string, newStatus: PayoutStatus) => {
    setActionMsg((prev) => ({ ...prev, [churchId]: "…" }));
    const { error } = await supabase
      .from("churches")
      .update({ payout_status: newStatus })
      .eq("id", churchId);

    if (error) {
      setActionMsg((prev) => ({ ...prev, [churchId]: error.message }));
    } else {
      setRows((prev) =>
        prev.map((r) => (r.id === churchId ? { ...r, payout_status: newStatus } : r))
      );
      setActionMsg((prev) => ({ ...prev, [churchId]: newStatus === "approved" ? "✓" : "✗" }));
    }
  };

  const statusBadge = (s: PayoutStatus) => {
    const map: Record<PayoutStatus, string> = {
      not_started:    "bg-gray-100 text-gray-500",
      pending_review: "bg-amber-100 text-amber-700",
      approved:       "bg-emerald-100 text-emerald-700",
      rejected:       "bg-red-100 text-red-700",
    };
    return map[s] ?? "bg-gray-100 text-gray-500";
  };

  const statusLabel = (s: PayoutStatus) => {
    const map: Record<PayoutStatus, string> = {
      not_started:    t("payout_status_not_started"),
      pending_review: t("payout_status_pending"),
      approved:       t("payout_status_approved"),
      rejected:       t("payout_status_rejected"),
    };
    return map[s] ?? s;
  };

  const methodLabel = (m: string | null) => {
    if (!m) return "—";
    const map: Record<string, string> = {
      stripe_connect:       t("payout_method_stripe"),
      bank_transfer_review: t("payout_method_bank"),
      manual_review:        t("payout_method_manual"),
    };
    return map[m] ?? m;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t("payout_admin_title")}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {isFr
            ? "Examinez les demandes de versement des églises. Aucun numéro de compte complet n'est visible ici."
            : "Review church payout requests. No full account numbers are visible here."}
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["pending_review", "approved", "rejected", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              filter === f
                ? "bg-amber-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f === "all" ? (isFr ? "Tous" : "All") : statusLabel(f as PayoutStatus)}
            {f !== "all" && (
              <span className="ml-1.5 text-xs opacity-70">
                ({rows.filter((r) => r.payout_status === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-white py-16 text-center shadow-sm">
          <p className="text-3xl mb-2">💳</p>
          <p className="font-semibold text-gray-700">{t("payout_admin_none")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => (
            <div key={row.id} className="rounded-2xl bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{row.name}</h3>
                  {row.payout_contact_name && (
                    <p className="text-sm text-gray-500">{row.payout_contact_name}</p>
                  )}
                  {row.payout_contact_email && (
                    <a
                      href={`mailto:${row.payout_contact_email}`}
                      className="text-sm text-brand-600 hover:underline"
                    >
                      {row.payout_contact_email}
                    </a>
                  )}
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusBadge(row.payout_status)}`}>
                  {statusLabel(row.payout_status)}
                </span>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                {[
                  { label: isFr ? "Pays" : "Country",  value: row.payout_country },
                  { label: isFr ? "Méthode" : "Method", value: methodLabel(row.preferred_payout_method) },
                  { label: isFr ? "Banque" : "Bank",    value: row.payout_bank_name },
                  { label: isFr ? "Titulaire" : "Holder", value: row.payout_account_holder },
                  { label: isFr ? "4 derniers" : "Last 4", value: row.payout_last4 ? `••••${row.payout_last4}` : null },
                ].map((f) =>
                  f.value ? (
                    <div key={f.label} className="rounded-xl bg-gray-50 px-3 py-2">
                      <p className="text-xs font-medium text-gray-400">{f.label}</p>
                      <p className="font-medium text-gray-800">{f.value}</p>
                    </div>
                  ) : null
                )}
              </div>

              {/* Action buttons */}
              {row.payout_status === "pending_review" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => updateStatus(row.id, "approved")}
                    className="flex-1 rounded-xl bg-emerald-500 py-2 text-sm font-bold text-white hover:bg-emerald-600"
                  >
                    {t("payout_admin_approve")}
                  </button>
                  <button
                    onClick={() => updateStatus(row.id, "rejected")}
                    className="flex-1 rounded-xl bg-red-100 py-2 text-sm font-bold text-red-700 hover:bg-red-200"
                  >
                    {t("payout_admin_reject")}
                  </button>
                </div>
              )}
              {row.payout_status === "approved" && (
                <button
                  onClick={() => updateStatus(row.id, "rejected")}
                  className="w-full rounded-xl bg-red-50 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
                >
                  {isFr ? "Révoquer l'approbation" : "Revoke approval"}
                </button>
              )}
              {row.payout_status === "rejected" && (
                <button
                  onClick={() => updateStatus(row.id, "pending_review")}
                  className="w-full rounded-xl bg-amber-50 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100"
                >
                  {isFr ? "Remettre en attente" : "Move back to review"}
                </button>
              )}

              {actionMsg[row.id] && (
                <p className="text-center text-sm text-gray-500">{actionMsg[row.id]}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
