"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import { useLanguage } from "../../../../lib/useLanguage";

type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";

type ExistingRecord = {
  status: VerificationStatus;
  pastor_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  rejection_reason: string | null;
  created_at: string;
};

export default function ChurchVerifyPage() {
  const params = useParams();
  const router = useRouter();
  const { lang, t } = useLanguage();
  const churchId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<ExistingRecord | null>(null);
  const [uiMessage, setUiMessage] = useState("");

  // Form fields
  const [pastorName, setPastorName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [regDocFile, setRegDocFile] = useState<File | null>(null);
  const [pastorIdFile, setPastorIdFile] = useState<File | null>(null);
  const [addressProofFile, setAddressProofFile] = useState<File | null>(null);

  useEffect(() => {
    loadPage();
  }, [churchId]);

  async function loadPage() {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    const me = authData.user?.id;
    if (!me) { router.push("/login"); return; }

    // Verify this user is the church admin
    const { data: profileData } = await supabase
      .from("profiles")
      .select("role, church_id")
      .eq("id", me)
      .maybeSingle();

    if (profileData?.role !== "church_admin" || profileData?.church_id !== churchId) {
      router.push("/profile");
      return;
    }

    // Check for existing verification record
    const { data: verif } = await supabase
      .from("church_verifications")
      .select("status, pastor_name, contact_email, contact_phone, address, rejection_reason, created_at")
      .eq("church_id", churchId)
      .maybeSingle();

    if (verif) {
      setExisting(verif as ExistingRecord);
      setPastorName(verif.pastor_name || "");
      setEmail(verif.contact_email || "");
      setPhone(verif.contact_phone || "");
      setAddress(verif.address || "");
    }

    setLoading(false);
  }

  const uploadDoc = async (file: File, bucket: string, prefix: string) => {
    const ext = file.name.split(".").pop();
    const path = `${churchId}/${prefix}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) throw new Error(`Upload failed: ${error.message}`);
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setUiMessage("");

    try {
      let regDocUrl: string | undefined;
      let pastorIdUrl: string | undefined;
      let addressProofUrl: string | undefined;

      // Upload documents to "church-docs" bucket (should be private in Supabase)
      if (regDocFile) regDocUrl = await uploadDoc(regDocFile, "church-docs", "registration");
      if (pastorIdFile) pastorIdUrl = await uploadDoc(pastorIdFile, "church-docs", "pastor-id");
      if (addressProofFile) addressProofUrl = await uploadDoc(addressProofFile, "church-docs", "address-proof");

      const { data: authData } = await supabase.auth.getUser();
      const me = authData.user?.id;

      const payload = {
        church_id: churchId,
        submitted_by: me,
        status: "pending" as const,
        pastor_name: pastorName.trim() || null,
        contact_email: email.trim() || null,
        contact_phone: phone.trim() || null,
        address: address.trim() || null,
        ...(regDocUrl && { registration_doc_url: regDocUrl }),
        ...(pastorIdUrl && { pastor_id_url: pastorIdUrl }),
        ...(addressProofUrl && { address_proof_url: addressProofUrl }),
      };

      const { error } = await supabase
        .from("church_verifications")
        .upsert([payload], { onConflict: "church_id" });

      if (error) throw new Error(error.message);

      setUiMessage(t("verify_submitted"));
      await loadPage();
    } catch (err: unknown) {
      setUiMessage(`${t("common_error")} ${(err as Error).message}`);
    }

    setSaving(false);
  };

  const statusColor = (status: VerificationStatus) => {
    switch (status) {
      case "verified": return "bg-emerald-100 text-emerald-700";
      case "pending": return "bg-amber-100 text-amber-700";
      case "rejected": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-600";
    }
  };

  const statusLabel = (status: VerificationStatus) => {
    switch (status) {
      case "verified": return t("verify_status_verified");
      case "pending": return t("verify_status_pending");
      case "rejected": return t("verify_status_rejected");
      default: return t("verify_status_unverified");
    }
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
          <h1 className="font-bold text-gray-900">{t("verify_step_title")}</h1>
          <p className="text-xs text-gray-500">{t("church_verify_desc")}</p>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 py-6 space-y-5">

        {/* Current status */}
        {existing && (
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-800">{t("verify_step_title")}</p>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusColor(existing.status)}`}>
                {statusLabel(existing.status)}
              </span>
            </div>

            {existing.status === "pending" && (
              <p className="mt-2 text-sm text-gray-500">{t("verify_already_submitted")}</p>
            )}

            {existing.status === "verified" && (
              <p className="mt-2 flex items-center gap-1 text-sm font-medium text-emerald-600">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" />
                </svg>
                {t("verify_status_verified")}
              </p>
            )}

            {existing.status === "rejected" && existing.rejection_reason && (
              <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {existing.rejection_reason}
              </div>
            )}
          </div>
        )}

        {/* Submission form — show if not yet verified */}
        {existing?.status !== "verified" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-2xl bg-white p-5 shadow-sm space-y-4">
              <h2 className="font-semibold text-gray-900">{t("church_verify_title")}</h2>

              {[
                { label: t("verify_pastor_name"), value: pastorName, set: setPastorName, type: "text" },
                { label: t("verify_email"), value: email, set: setEmail, type: "email" },
                { label: t("verify_phone"), value: phone, set: setPhone, type: "tel" },
                { label: t("verify_address"), value: address, set: setAddress, type: "text" },
              ].map((f) => (
                <div key={f.label}>
                  <label className="mb-1 block text-sm font-medium text-gray-700">{f.label}</label>
                  <input
                    type={f.type}
                    value={f.value}
                    onChange={(e) => f.set(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
                  />
                </div>
              ))}
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm space-y-4">
              <h2 className="font-semibold text-gray-900">{t("verify_reg_doc").split("(")[0].trim()}</h2>
              <p className="text-xs text-gray-400">
                {lang === "fr"
                  ? "Les documents sont stockés en toute sécurité et ne sont accessibles qu'aux administrateurs de la plateforme."
                  : "Documents are stored securely and accessible only to platform administrators."}
              </p>

              {[
                { label: t("verify_reg_doc"), set: setRegDocFile },
                { label: t("verify_pastor_id"), set: setPastorIdFile },
                { label: t("verify_address_proof"), set: setAddressProofFile },
              ].map((f) => (
                <div key={f.label}>
                  <label className="mb-1 block text-sm font-medium text-gray-700">{f.label}</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => f.set(e.target.files?.[0] || null)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-amber-400"
                  />
                </div>
              ))}
            </div>

            {uiMessage && (
              <div className={`rounded-xl px-4 py-3 text-sm ${
                uiMessage.includes(t("verify_submitted"))
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-600"
              }`}>
                {uiMessage}
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
