"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { useLanguage } from "../../../lib/useLanguage";

type VerifRow = {
  id: string;
  church_id: string;
  church_name: string | null;
  submitted_by: string;
  submitter_name: string | null;
  status: string;
  pastor_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  registration_doc_url: string | null;
  pastor_id_url: string | null;
  address_proof_url: string | null;
  rejection_reason: string | null;
  created_at: string;
};

export default function AdminVerificationsPage() {
  const { t } = useLanguage();
  const [verifs, setVerifs] = useState<VerifRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [reasonMap, setReasonMap] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data, error: dbError } = await supabase
      .from("church_verifications")
      .select(`
        id, church_id, submitted_by, status,
        pastor_name, contact_email, contact_phone, address,
        registration_doc_url, pastor_id_url, address_proof_url,
        rejection_reason, created_at,
        churches ( name ),
        profiles ( full_name )
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (dbError) { setError(dbError.message); }
    else {
      setVerifs((data ?? []).map((row: Record<string, unknown>) => ({
        ...row,
        church_name: (row.churches as { name?: string } | null)?.name ?? null,
        submitter_name: (row.profiles as { full_name?: string } | null)?.full_name ?? null,
      })) as VerifRow[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const review = async (churchId: string, status: "verified" | "rejected", reason?: string) => {
    setSavingId(churchId);
    const { error: rpcError } = await supabase.rpc("review_church_verification", {
      p_church_id: churchId,
      p_status: status,
      p_rejection_reason: reason ?? null,
    });
    if (rpcError) setError(rpcError.message);
    else await load();
    setSavingId(null);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">{t("admin_verif_title")}</h1>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
        </div>
      ) : verifs.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-gray-400">{t("admin_verif_none")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {verifs.map((v) => (
            <div key={v.id} className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-gray-900">{v.church_name ?? v.church_id}</p>
                  <p className="text-xs text-gray-400">
                    {t("verify_pastor_name")}: {v.pastor_name ?? "—"} ·{" "}
                    {t("verify_email")}: {v.contact_email ?? "—"} ·{" "}
                    {t("verify_phone")}: {v.contact_phone ?? "—"}
                  </p>
                  <p className="text-xs text-gray-400">{t("verify_address")}: {v.address ?? "—"}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(v.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                  {v.status}
                </span>
              </div>

              {/* Documents */}
              <div className="flex flex-wrap gap-2">
                {v.registration_doc_url && (
                  <a
                    href={v.registration_doc_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
                  >
                    {t("verify_reg_doc").split("(")[0].trim()} ↗
                  </a>
                )}
                {v.pastor_id_url && (
                  <a
                    href={v.pastor_id_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
                  >
                    {t("verify_pastor_id").split("(")[0].trim()} ↗
                  </a>
                )}
                {v.address_proof_url && (
                  <a
                    href={v.address_proof_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
                  >
                    {t("verify_address_proof").split("(")[0].trim()} ↗
                  </a>
                )}
              </div>

              {/* Rejection reason input */}
              <textarea
                rows={2}
                placeholder={t("admin_verif_reason")}
                value={reasonMap[v.church_id] ?? ""}
                onChange={(e) => setReasonMap((prev) => ({ ...prev, [v.church_id]: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-amber-400 resize-none"
              />

              <div className="flex gap-3">
                <button
                  disabled={savingId === v.church_id}
                  onClick={() => review(v.church_id, "verified")}
                  className="flex-1 rounded-xl bg-emerald-500 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                >
                  {t("admin_verif_approve")}
                </button>
                <button
                  disabled={savingId === v.church_id}
                  onClick={() => review(v.church_id, "rejected", reasonMap[v.church_id])}
                  className="flex-1 rounded-xl bg-red-500 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                >
                  {t("admin_verif_reject")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
