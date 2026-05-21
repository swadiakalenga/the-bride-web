"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import { useLanguage } from "../../../../lib/useLanguage";

type PayoutStatus = "not_started" | "pending_review" | "approved" | "rejected";

export default function ChurchPayoutsPage() {
  const params   = useParams();
  const router   = useRouter();
  const { t, lang } = useLanguage();
  const churchId = params.id as string;
  const isFr     = lang === "fr";

  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [message,    setMessage]    = useState("");
  const [isError,    setIsError]    = useState(false);
  const [churchName, setChurchName] = useState("");

  const [contactName,  setContactName]  = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [country,      setCountry]      = useState("");
  const [status,       setStatus]       = useState<PayoutStatus>("not_started");

  useEffect(() => { loadPage(); }, [churchId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadPage() {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    const me = authData.user?.id;
    if (!me) { router.push("/login"); return; }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, church_id")
      .eq("id", me)
      .maybeSingle();

    if (profile?.role !== "church_admin" || profile?.church_id !== churchId) {
      router.push("/profile");
      return;
    }

    const { data: church } = await supabase
      .from("churches")
      .select("name, payout_contact_name, payout_contact_email, payout_country, payout_status")
      .eq("id", churchId)
      .maybeSingle();

    if (church) {
      setChurchName(church.name ?? "");
      setContactName(church.payout_contact_name ?? "");
      setContactEmail(church.payout_contact_email ?? "");
      setCountry(church.payout_country ?? "");
      setStatus((church.payout_status as PayoutStatus) ?? "not_started");
    }

    setLoading(false);
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setIsError(false);

    const { error } = await supabase
      .from("churches")
      .update({
        payout_contact_name:  contactName.trim() || null,
        payout_contact_email: contactEmail.trim() || null,
        payout_country:       country.trim() || null,
        payout_status:        status === "not_started" ? "pending_review" : status,
      })
      .eq("id", churchId);

    setSaving(false);

    if (error) {
      setMessage(error.message);
      setIsError(true);
    } else {
      setMessage(t("payout_saved"));
      setIsError(false);
      if (status === "not_started") setStatus("pending_review");
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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3 shadow-sm">
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
          aria-label={t("common_back")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div>
          <h1 className="font-bold text-gray-900">{t("payout_title")}</h1>
          <p className="text-xs text-gray-500">{churchName}</p>
        </div>
        {status !== "not_started" && (
          <span className={`ml-auto rounded-full px-3 py-1 text-xs font-bold ${statusBadge(status)}`}>
            {statusLabel(status)}
          </span>
        )}
      </header>

      <div className="mx-auto max-w-lg px-4 py-6 space-y-5">

        {/* Info banner */}
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-1">
          <p className="font-semibold text-amber-900">{t("payout_title")}</p>
          <p className="text-sm text-amber-800">{t("payout_desc")}</p>
        </div>

        {/* Stripe Connect note */}
        <div className="rounded-2xl bg-blue-50 border border-blue-100 px-4 py-3 flex items-start gap-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p className="text-sm text-blue-800">{t("payout_stripe_note")}</p>
        </div>

        <form onSubmit={handleSave} className="space-y-4">

          {/* Financial contact */}
          <div className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
            <h2 className="font-semibold text-gray-900">
              {isFr ? "Responsable financier" : "Financial contact"}
            </h2>
            {[
              { label: t("payout_contact_name"),  value: contactName,  set: setContactName,  type: "text" },
              { label: t("payout_contact_email"), value: contactEmail, set: setContactEmail, type: "email" },
              { label: t("payout_country"),       value: country,      set: setCountry,      type: "text" },
            ].map((f) => (
              <div key={f.label}>
                <label className="mb-1 block text-sm font-medium text-gray-700">{f.label}</label>
                <input
                  type={f.type}
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-amber-400 focus:bg-white"
                />
              </div>
            ))}
          </div>

          {/* Payout account — Stripe Connect placeholder */}
          <div className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
            <h2 className="font-semibold text-gray-900">
              {isFr ? "Compte de paiement" : "Payout account"}
            </h2>
            <p className="text-sm text-gray-500">
              {isFr
                ? "La connexion sécurisée du compte bancaire se fera via Stripe Connect. Stripe collecte vos coordonnées bancaires directement — TheBride ne stocke jamais vos numéros de compte."
                : "Secure bank account connection will be done via Stripe Connect. Stripe collects your banking details directly — TheBride never stores your account numbers."}
            </p>
            <button
              type="button"
              disabled
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-100 py-3 text-sm font-semibold text-gray-400 cursor-not-allowed"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
              {isFr ? "Connecter le compte de paiement — bientôt disponible" : "Connect payout account — coming soon"}
            </button>
          </div>

          {message && (
            <div className={`rounded-xl px-4 py-3 text-sm ${isError ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-2xl bg-amber-500 py-3 font-bold text-white shadow-sm hover:bg-amber-600 disabled:opacity-60"
          >
            {saving ? "…" : t("payout_save")}
          </button>
        </form>
      </div>
    </main>
  );
}
