"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useLanguage } from "../../lib/useLanguage";
import { useRedirectIfPlatformAdmin } from "../../lib/auth/redirectIfPlatformAdmin";

const CATEGORIES = [
  "bug",
  "payment",
  "live_stream",
  "account",
  "church",
  "messaging",
  "feature_request",
  "other",
] as const;

const CATEGORY_LABELS: Record<string, { en: string; fr: string }> = {
  bug:             { en: "Bug / Error",      fr: "Bug / Erreur" },
  payment:         { en: "Payment",          fr: "Paiement" },
  live_stream:     { en: "Live Stream",      fr: "Diffusion en direct" },
  account:         { en: "My Account",       fr: "Mon compte" },
  church:          { en: "Church",           fr: "Église" },
  messaging:       { en: "Messaging",        fr: "Messagerie" },
  feature_request: { en: "Feature Request",  fr: "Suggestion" },
  other:           { en: "Other",            fr: "Autre" },
};

const STATUS_COLORS: Record<string, string> = {
  open:        "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  resolved:    "bg-emerald-100 text-emerald-700",
  closed:      "bg-gray-100 text-gray-600",
};

const STATUS_LABELS: Record<string, { en: string; fr: string }> = {
  open:        { en: "Open",        fr: "Ouvert" },
  in_progress: { en: "In progress", fr: "En cours" },
  resolved:    { en: "Resolved",    fr: "Résolu" },
  closed:      { en: "Closed",      fr: "Fermé" },
};

type Ticket = {
  id: string;
  category: string;
  subject: string;
  status: string;
  admin_response: string | null;
  created_at: string;
};

export default function HelpPage() {
  useRedirectIfPlatformAdmin();
  const { t } = useLanguage();
  const { lang } = useLanguage();
  const router = useRouter();
  const isFr = lang === "fr";

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [loading, setLoading] = useState(true);

  const [category, setCategory] = useState("bug");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedId, setSubmittedId] = useState("");
  const [formError, setFormError] = useState("");

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      setUserId(user.id);
      setUserEmail(user.email ?? "");
      setLoading(false);
    })();
  }, [router]);

  const loadTickets = useCallback(async () => {
    if (!userId) return;
    setTicketsLoading(true);
    const { data } = await supabase
      .from("support_tickets")
      .select("id, category, subject, status, admin_response, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    setTickets((data as Ticket[]) ?? []);
    setTicketsLoading(false);
  }, [userId]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const handleSubmit = async () => {
    if (!userId) return;
    setFormError("");

    if (!subject.trim()) {
      setFormError(isFr ? "Veuillez saisir un sujet." : "Please enter a subject.");
      return;
    }
    if (message.trim().length < 10) {
      setFormError(isFr ? "Veuillez décrire le problème (min. 10 caractères)." : "Please describe the issue (min. 10 characters).");
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase
      .from("support_tickets")
      .insert({
        user_id:  userId,
        email:    userEmail,
        category,
        subject:  subject.trim(),
        message:  message.trim(),
        status:   "open",
        priority: "normal",
      })
      .select("id")
      .single();

    if (error) {
      setFormError(error.message);
      setSubmitting(false);
      return;
    }

    setSubmittedId(data.id);
    setSubmitted(true);
    setSubject("");
    setMessage("");
    setCategory("bug");
    setSubmitting(false);
    await loadTickets();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3 shadow-sm">
        <button
          onClick={() => router.back()}
          aria-label={t("common_back")}
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className="font-bold text-gray-900">
          {isFr ? "Aide & Support" : "Help & Support"}
        </h1>
      </header>

      <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        {/* Title block */}
        <div>
          <p className="text-sm text-gray-500">
            {isFr
              ? "Dites-nous ce qui s'est passé. Nous examinerons votre demande."
              : "Tell us what happened. We will review your request."}
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          {submitted ? (
            <div className="space-y-3 py-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-semibold text-gray-900">
                {isFr ? "Votre ticket de support a été soumis." : "Your support ticket was submitted."}
              </p>
              <p className="text-xs text-gray-400">
                {isFr ? "Référence" : "Reference"}:{" "}
                <span className="font-mono font-semibold text-gray-700">
                  #{submittedId.slice(0, 8).toUpperCase()}
                </span>
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="mt-2 text-sm font-medium text-amber-600 hover:text-amber-700"
              >
                {isFr ? "Soumettre un autre ticket" : "Submit another ticket"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Category */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {isFr ? "Catégorie" : "Category"}
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {isFr ? CATEGORY_LABELS[cat].fr : CATEGORY_LABELS[cat].en}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {isFr ? "Sujet" : "Subject"}
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={isFr ? "Résumé du problème" : "Brief summary of the issue"}
                  maxLength={200}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                />
              </div>

              {/* Message */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {isFr ? "Message" : "Message"}
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  placeholder={isFr ? "Décrivez le problème en détail…" : "Describe the issue in detail…"}
                  maxLength={5000}
                  className="w-full resize-none rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                />
              </div>

              {formError && <p className="text-sm text-red-600">{formError}</p>}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full rounded-xl bg-amber-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
              >
                {submitting
                  ? (isFr ? "Envoi…" : "Submitting…")
                  : (isFr ? "Envoyer" : "Submit")}
              </button>

              <p className="text-center text-xs text-gray-400">
                {isFr ? "Pour les urgences, contactez " : "If this is urgent, email "}
                <a
                  href="mailto:support@thebride.app"
                  className="font-medium text-amber-600 hover:underline"
                >
                  support@thebride.app
                </a>
              </p>
            </div>
          )}
        </div>

        {/* My Tickets */}
        <div>
          <h2 className="mb-3 text-base font-semibold text-gray-900">
            {isFr ? "Mes tickets" : "My Tickets"}
          </h2>

          {ticketsLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 bg-gray-50 py-10 text-center">
              <p className="text-sm text-gray-400">
                {isFr ? "Aucun ticket soumis" : "No tickets submitted yet"}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-gray-900">{ticket.subject}</p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {isFr
                          ? (CATEGORY_LABELS[ticket.category]?.fr ?? ticket.category)
                          : (CATEGORY_LABELS[ticket.category]?.en ?? ticket.category)}
                        {" · "}
                        #{ticket.id.slice(0, 8).toUpperCase()}
                        {" · "}
                        {new Date(ticket.created_at).toLocaleDateString(isFr ? "fr-FR" : "en-US")}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[ticket.status] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {isFr
                        ? (STATUS_LABELS[ticket.status]?.fr ?? ticket.status)
                        : (STATUS_LABELS[ticket.status]?.en ?? ticket.status)}
                    </span>
                  </div>

                  {ticket.admin_response && (
                    <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5">
                      <p className="mb-1 text-xs font-semibold text-amber-700">
                        {isFr ? "Réponse de l'équipe" : "Team response"}
                      </p>
                      <p className="text-sm text-gray-800">{ticket.admin_response}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
