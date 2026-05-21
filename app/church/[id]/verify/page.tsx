"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import { useLanguage } from "../../../../lib/useLanguage";

type LocationStatus = "not_submitted" | "pending" | "approved" | "rejected";

type Church = {
  name: string;
  physical_address: string | null;
  address_line2: string | null;
  state_region: string | null;
  postal_code: string | null;
  location: string | null;
};

type ExistingVerif = {
  status: string;
  pastor_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  location_proof_url: string | null;
  location_proof_type: string | null;
  location_notes: string | null;
  rejection_reason: string | null;
  created_at: string;
};

const PROOF_TYPES = [
  "utility_bill",
  "lease",
  "court",
  "property",
  "letter",
  "other",
] as const;

type ProofType = typeof PROOF_TYPES[number];

export default function ChurchVerifyPage() {
  const params   = useParams();
  const router   = useRouter();
  const { lang, t } = useLanguage();
  const churchId = params.id as string;
  const isFr     = lang === "fr";

  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [church,   setChurch]   = useState<Church | null>(null);
  const [existing, setExisting] = useState<ExistingVerif | null>(null);
  const [message,  setMessage]  = useState("");
  const [isError,  setIsError]  = useState(false);

  // Contact fields
  const [pastorName,  setPastorName]  = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // Location proof
  const [proofType, setProofType] = useState<ProofType>("utility_bill");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [notes,     setNotes]     = useState("");

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

    const [{ data: churchData }, { data: verif }] = await Promise.all([
      supabase
        .from("churches")
        .select("name, physical_address, address_line2, state_region, postal_code, location")
        .eq("id", churchId)
        .maybeSingle(),
      supabase
        .from("church_verifications")
        .select("status, pastor_name, contact_email, contact_phone, address, location_proof_url, location_proof_type, location_notes, rejection_reason, created_at")
        .eq("church_id", churchId)
        .maybeSingle(),
    ]);

    setChurch(churchData ?? null);

    if (verif) {
      setExisting(verif as ExistingVerif);
      setPastorName(verif.pastor_name ?? "");
      setContactEmail(verif.contact_email ?? "");
      setContactPhone(verif.contact_phone ?? "");
      if (verif.location_proof_type) setProofType(verif.location_proof_type as ProofType);
      setNotes(verif.location_notes ?? "");
    }

    setLoading(false);
  }

  const proofTypeLabel = (type: ProofType) => {
    const map: Record<ProofType, string> = {
      utility_bill: t("verify_location_proof_type_utility"),
      lease:        t("verify_location_proof_type_lease"),
      court:        t("verify_location_proof_type_court"),
      property:     t("verify_location_proof_type_property"),
      letter:       t("verify_location_proof_type_letter"),
      other:        t("verify_location_proof_type_other"),
    };
    return map[type];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proofFile && !existing?.location_proof_url) {
      setIsError(true);
      setMessage(isFr ? "Veuillez joindre un document de preuve d'emplacement." : "Please attach a location proof document.");
      return;
    }

    setSaving(true);
    setMessage("");
    setIsError(false);

    try {
      let proofUrl = existing?.location_proof_url ?? null;

      if (proofFile) {
        const ext  = proofFile.name.split(".").pop();
        const path = `${churchId}/location-proof-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("church-documents")
          .upload(path, proofFile, { upsert: true });
        if (upErr) throw new Error(upErr.message);
        // Signed URL generated server-side by admin — store path only
        proofUrl = path;
      }

      const { data: authData } = await supabase.auth.getUser();
      const me = authData.user?.id;

      const payload = {
        church_id:           churchId,
        submitted_by:        me,
        status:              "pending" as const,
        pastor_name:         pastorName.trim()    || null,
        contact_email:       contactEmail.trim()  || null,
        contact_phone:       contactPhone.trim()  || null,
        address:             church?.physical_address ?? null,
        location_proof_url:  proofUrl,
        location_proof_type: proofType,
        location_notes:      notes.trim() || null,
      };

      const { error } = await supabase
        .from("church_verifications")
        .upsert([payload], { onConflict: "church_id" });

      if (error) throw new Error(error.message);

      // Update church location_verification_status to pending
      await supabase
        .from("churches")
        .update({ location_verification_status: "pending" })
        .eq("id", churchId);

      setMessage(t("verify_submitted"));
      setIsError(false);
      await loadPage();
    } catch (err: unknown) {
      setMessage((err as Error).message);
      setIsError(true);
    }

    setSaving(false);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending:  "bg-amber-100 text-amber-700",
      verified: "bg-emerald-100 text-emerald-700",
      approved: "bg-emerald-100 text-emerald-700",
      rejected: "bg-red-100 text-red-700",
    };
    return map[status] ?? "bg-gray-100 text-gray-600";
  };

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending:  t("verify_status_pending"),
      verified: t("verify_status_verified"),
      approved: t("verify_status_verified"),
      rejected: t("verify_status_rejected"),
    };
    return map[status] ?? t("verify_status_unverified");
  };

  const physicalAddress = [
    church?.physical_address,
    church?.address_line2,
    church?.state_region,
    church?.postal_code,
  ].filter(Boolean).join(", ") || church?.location || null;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
      </div>
    );
  }

  const isVerified = existing?.status === "verified" || existing?.status === "approved";
  const isPending  = existing?.status === "pending";

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
          <h1 className="font-bold text-gray-900">{t("verify_step_title")}</h1>
          <p className="text-xs text-gray-500">{church?.name}</p>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 py-6 space-y-5">

        {/* Status card */}
        {existing && (
          <div className="rounded-2xl bg-white p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-800">{t("verify_step_title")}</p>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusBadge(existing.status)}`}>
                {statusLabel(existing.status)}
              </span>
            </div>
            {isPending && (
              <p className="text-sm text-gray-500">{t("verify_already_submitted")}</p>
            )}
            {isVerified && (
              <p className="flex items-center gap-1 text-sm font-medium text-emerald-600">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/>
                </svg>
                {t("verify_status_verified")}
              </p>
            )}
            {existing.status === "rejected" && existing.rejection_reason && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {existing.rejection_reason}
              </div>
            )}
          </div>
        )}

        {/* What we need — info card */}
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
          <p className="font-semibold text-amber-900 mb-1">{t("verify_location_title")}</p>
          <p className="text-sm text-amber-800">{t("verify_location_desc")}</p>
          <ul className="mt-2 space-y-0.5 text-sm text-amber-700">
            {(["utility_bill", "lease", "court", "property", "letter", "other"] as ProofType[]).map((pt) => (
              <li key={pt} className="flex items-center gap-1.5">
                <span className="text-amber-500">•</span>
                {proofTypeLabel(pt)}
              </li>
            ))}
          </ul>
        </div>

        {/* Form */}
        {!isVerified && (
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Current address */}
            {physicalAddress && (
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
                  {t("church_addr_physical")}
                </p>
                <p className="text-sm text-gray-700">{physicalAddress}</p>
                <button
                  type="button"
                  onClick={() => router.push(`/church/${churchId}/payouts`)}
                  className="mt-1 text-xs text-brand-600 hover:underline"
                >
                  {isFr ? "Modifier l'adresse dans les paramètres" : "Edit address in settings"}
                </button>
              </div>
            )}

            {/* Contact info */}
            <div className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
              <h2 className="font-semibold text-gray-900">
                {isFr ? "Informations de contact" : "Contact information"}
              </h2>
              {[
                { label: t("verify_pastor_name"), value: pastorName,     set: setPastorName,    type: "text" },
                { label: t("verify_email"),       value: contactEmail,   set: setContactEmail,  type: "email" },
                { label: t("verify_phone"),       value: contactPhone,   set: setContactPhone,  type: "tel" },
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

            {/* Location proof upload */}
            <div className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
              <h2 className="font-semibold text-gray-900">{t("verify_location_title")}</h2>
              <p className="text-xs text-gray-400">
                {isFr
                  ? "Les documents sont chiffrés et accessibles uniquement aux administrateurs de la plateforme."
                  : "Documents are encrypted and accessible only to platform administrators."}
              </p>

              {/* Existing proof preview */}
              {existing?.location_proof_url && (
                <div className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700">
                  {isFr ? "Document déjà soumis. Joignez un nouveau fichier pour le remplacer." : "Document already submitted. Attach a new file to replace it."}
                </div>
              )}

              {/* Document type */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("verify_location_proof_type_label")}
                </label>
                <select
                  value={proofType}
                  onChange={(e) => setProofType(e.target.value as ProofType)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-amber-400"
                >
                  {(["utility_bill", "lease", "court", "property", "letter", "other"] as ProofType[]).map((pt) => (
                    <option key={pt} value={pt}>{proofTypeLabel(pt)}</option>
                  ))}
                </select>
              </div>

              {/* File upload */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("verify_location_proof_label")}
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-amber-400"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("verify_location_notes_label")}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={isFr ? "Contexte ou précisions pour l'examinateur…" : "Context or details for the reviewer…"}
                  className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-amber-400"
                />
              </div>
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
              {saving ? "…" : t("verify_submit")}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
