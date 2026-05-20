"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { useLanguage } from "../../../lib/useLanguage";

const fr = {
  title: "Compte et suppression",
  gracePeriod: {
    heading: "Suppression programmée",
    desc: (date: string) => `Votre compte sera définitivement supprimé le ${date}.`,
    cancel: "Annuler la suppression",
    cancelling: "Annulation…",
    cancelSuccess: "Suppression annulée. Votre compte est réactivé.",
  },
  deleteSection: {
    heading: "Supprimer mon compte",
    warning: "Cette action est irréversible après la période de grâce de 30 jours. Votre compte sera immédiatement désactivé et vos données seront définitivement supprimées après 30 jours.",
    bullet1: "Vous pouvez annuler dans les 30 jours.",
    bullet2: "Vos publications, commentaires et messages seront effacés.",
    bullet3: "Vos journaux de modération sont conservés 3 ans conformément à la loi.",
    requestBtn: "Supprimer mon compte",
    requesting: "En cours…",
  },
  modal: {
    heading: "Confirmer la suppression de compte",
    body: "Votre compte sera désactivé immédiatement. Vous avez 30 jours pour annuler avant la suppression définitive de toutes vos données.",
    reasonLabel: "Raison (facultatif)",
    reasonPlaceholder: "Pourquoi supprimez-vous votre compte ?",
    confirm: "Oui, supprimer mon compte",
    cancel: "Annuler",
  },
  successMsg: (date: string) => `Suppression programmée pour le ${date}. Votre compte est désactivé.`,
  errorPrefix: "Erreur : ",
  loading: "Chargement…",
};

const en = {
  title: "Account & Deletion",
  gracePeriod: {
    heading: "Deletion Scheduled",
    desc: (date: string) => `Your account will be permanently deleted on ${date}.`,
    cancel: "Cancel deletion",
    cancelling: "Cancelling…",
    cancelSuccess: "Deletion cancelled. Your account is reactivated.",
  },
  deleteSection: {
    heading: "Delete my account",
    warning: "This action is irreversible after the 30-day grace period. Your account will be immediately deactivated and your data permanently deleted after 30 days.",
    bullet1: "You can cancel within 30 days.",
    bullet2: "Your posts, comments, and messages will be erased.",
    bullet3: "Moderation logs are retained 3 years under applicable law.",
    requestBtn: "Delete my account",
    requesting: "Processing…",
  },
  modal: {
    heading: "Confirm Account Deletion",
    body: "Your account will be immediately deactivated. You have 30 days to cancel before all your data is permanently deleted.",
    reasonLabel: "Reason (optional)",
    reasonPlaceholder: "Why are you deleting your account?",
    confirm: "Yes, delete my account",
    cancel: "Cancel",
  },
  successMsg: (date: string) => `Deletion scheduled for ${date}. Your account is now deactivated.`,
  errorPrefix: "Error: ",
  loading: "Loading…",
};

function formatDate(iso: string, lang: "fr" | "en") {
  return new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });
}

export default function AccountSettingsPage() {
  const { lang } = useLanguage();
  const c = lang === "fr" ? fr : en;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    const check = async () => {
      const { data, error } = await supabase.rpc("get_deletion_request_status");
      if (!error && data?.has_pending_request) {
        setScheduledFor(data.scheduled_for);
      }
      setLoading(false);
    };
    check();
  }, []);

  const handleRequestDeletion = async () => {
    setRequesting(true);
    setMessage(null);
    const { data, error } = await supabase.rpc("request_account_deletion", { p_reason: reason || null });
    if (error) {
      setMessage({ text: c.errorPrefix + error.message, type: "error" });
      setRequesting(false);
      return;
    }
    setShowModal(false);
    setScheduledFor(data.scheduled_for);
    setMessage({ text: c.successMsg(formatDate(data.scheduled_for, lang)), type: "success" });
    setRequesting(false);

    // Sign out — account is now suspended
    setTimeout(async () => {
      await supabase.auth.signOut();
      router.replace("/login");
    }, 3000);
  };

  const handleCancelDeletion = async () => {
    setCancelling(true);
    setMessage(null);
    const { error } = await supabase.rpc("cancel_account_deletion");
    if (error) {
      setMessage({ text: c.errorPrefix + error.message, type: "error" });
      setCancelling(false);
      return;
    }
    setScheduledFor(null);
    setMessage({ text: c.gracePeriod.cancelSuccess, type: "success" });
    setCancelling(false);
  };

  if (loading) {
    return <p className="text-sm text-gray-500">{c.loading}</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{c.title}</h1>

      {message && (
        <div className={`rounded-xl px-4 py-3 text-sm ${
          message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
        }`}>
          {message.text}
        </div>
      )}

      {/* Pending deletion notice */}
      {scheduledFor && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-5">
          <p className="font-semibold text-red-700">{c.gracePeriod.heading}</p>
          <p className="mt-1 text-sm text-red-600">{c.gracePeriod.desc(formatDate(scheduledFor, lang))}</p>
          <button
            onClick={handleCancelDeletion}
            disabled={cancelling}
            className="mt-4 rounded-full border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
          >
            {cancelling ? c.gracePeriod.cancelling : c.gracePeriod.cancel}
          </button>
        </div>
      )}

      {/* Delete section — only shown if no pending request */}
      {!scheduledFor && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-gray-900">{c.deleteSection.heading}</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">{c.deleteSection.warning}</p>
          <ul className="mt-3 space-y-1">
            {[c.deleteSection.bullet1, c.deleteSection.bullet2, c.deleteSection.bullet3].map((b) => (
              <li key={b} className="flex gap-2 text-sm text-gray-500">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
                {b}
              </li>
            ))}
          </ul>
          <button
            onClick={() => setShowModal(true)}
            className="mt-5 rounded-full bg-red-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600 active:scale-[0.99]"
          >
            {c.deleteSection.requestBtn}
          </button>
        </div>
      )}

      {/* Confirmation modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">{c.modal.heading}</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">{c.modal.body}</p>

            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{c.modal.reasonLabel}</label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={c.modal.reasonPlaceholder}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-red-300 focus:bg-white focus:ring-2 focus:ring-red-100"
              />
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={handleRequestDeletion}
                disabled={requesting}
                className="w-full rounded-full bg-red-500 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600 disabled:opacity-50"
              >
                {requesting ? fr.deleteSection.requesting : c.modal.confirm}
              </button>
              <button
                onClick={() => setShowModal(false)}
                disabled={requesting}
                className="w-full rounded-full border border-gray-200 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                {c.modal.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
