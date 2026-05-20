"use client";

import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "../../../lib/useLanguage";
import { supabase } from "../../../lib/supabase";

const fr = {
  title: "Demande de suppression de données",
  updated: "Dernière mise à jour : 20 mai 2026",
  sections: [
    {
      heading: "Droit à l'effacement",
      body: "Conformément à l'article 17 du RGPD et aux droits similaires reconnus dans d'autres juridictions, vous avez le droit de demander la suppression complète de vos données personnelles détenues par TheBride. Ce droit peut être exercé à tout moment, sans justification obligatoire.",
    },
    {
      heading: "Comment soumettre une demande",
      body: "Vous pouvez soumettre une demande de suppression de données de deux façons :",
      list: [
        "Dans l'application : Paramètres → Compte → Supprimer le compte (méthode la plus rapide)",
        "Par e-mail : privacy@thebride.app avec pour objet « Demande de suppression de données »",
        "Via le formulaire ci-dessous",
      ],
    },
    {
      heading: "Ce que couvre la demande",
      body: "Une demande de suppression couvre l'ensemble de vos données personnelles : profil, publications, commentaires, messages, préférences et historique d'activité.",
    },
    {
      heading: "Exceptions",
      body: "Certaines données peuvent être conservées : journaux de modération (3 ans, conformité légale), enregistrements de dons anonymisés (7 ans, obligations fiscales), analyses agrégées anonymisées.",
    },
    {
      heading: "Délais",
      items: [
        { term: "Accusé de réception", def: "dans les 5 jours ouvrables." },
        { term: "Suppression complète", def: "dans les 30 jours suivant la vérification." },
      ],
    },
    {
      heading: "Si vous êtes dans l'UE ou au Royaume-Uni",
      body: "En tant que résident de l'UE ou du Royaume-Uni, vous bénéficiez de droits spécifiques au titre du RGPD (UE) et du UK GDPR : accès, rectification, limitation, portabilité et opposition. Si vos droits n'ont pas été respectés, vous pouvez déposer une plainte auprès de l'autorité de protection des données compétente.",
    },
  ],
  form: {
    heading: "Formulaire de demande",
    nameLabel: "Nom complet",
    namePlaceholder: "Votre nom",
    emailLabel: "Adresse e-mail du compte",
    emailPlaceholder: "you@example.com",
    typeLabel: "Type de demande",
    typeOptions: [
      { value: "full_deletion", label: "Suppression complète de mon compte et données" },
      { value: "specific_data", label: "Suppression de données spécifiques" },
      { value: "data_export", label: "Export de mes données avant suppression" },
    ],
    detailsLabel: "Précisions (facultatif)",
    detailsPlaceholder: "Décrivez les données que vous souhaitez supprimer…",
    submit: "Envoyer la demande",
    submitting: "Envoi…",
    success: "Demande reçue. Nous vous contacterons sous 5 jours ouvrables.",
    error: "Erreur lors de l'envoi. Écrivez directement à privacy@thebride.app.",
  },
  ctaLabel: "Supprimer mon compte",
  ctaHref: "/settings/account",
  relatedLinks: [
    { href: "/legal/account-deletion", label: "Politique de suppression de compte" },
    { href: "/legal/privacy", label: "Politique de confidentialité" },
  ],
  relatedTitle: "Documents liés",
};

const en = {
  title: "Data Deletion Request",
  updated: "Last updated: May 20, 2026",
  sections: [
    {
      heading: "Right to Erasure",
      body: "In accordance with Article 17 of the GDPR and similar rights recognized in other jurisdictions, you have the right to request complete deletion of your personal data held by TheBride. This right may be exercised at any time, without mandatory justification.",
    },
    {
      heading: "How to Submit a Request",
      body: "You can submit a data deletion request in three ways:",
      list: [
        "In the app: Settings → Account → Delete Account (fastest method)",
        "By email: privacy@thebride.app with subject \"Data Deletion Request\"",
        "Via the form below",
      ],
    },
    {
      heading: "What the Request Covers",
      body: "A deletion request covers all your personal data: profile, posts, comments, messages, preferences, and activity history.",
    },
    {
      heading: "Exceptions",
      body: "Certain data may be retained: moderation logs (3 years, legal compliance), anonymized donation records (7 years, tax obligations), anonymized aggregate analytics.",
    },
    {
      heading: "Timeline",
      items: [
        { term: "Acknowledgment", def: "within 5 business days." },
        { term: "Full deletion", def: "within 30 days of identity verification." },
      ],
    },
    {
      heading: "If You Are in the EU or UK",
      body: "As an EU or UK resident, you benefit from specific rights under GDPR (EU) and UK GDPR: access, rectification, restriction, portability, and objection. If your rights have not been respected, you may lodge a complaint with the competent data protection authority.",
    },
  ],
  form: {
    heading: "Request Form",
    nameLabel: "Full name",
    namePlaceholder: "Your name",
    emailLabel: "Account email address",
    emailPlaceholder: "you@example.com",
    typeLabel: "Request type",
    typeOptions: [
      { value: "full_deletion", label: "Full deletion of my account and all data" },
      { value: "specific_data", label: "Deletion of specific data only" },
      { value: "data_export", label: "Export my data before deletion" },
    ],
    detailsLabel: "Details (optional)",
    detailsPlaceholder: "Describe the specific data you would like deleted…",
    submit: "Submit request",
    submitting: "Submitting…",
    success: "Request received. We will contact you within 5 business days.",
    error: "Submission failed. Please write directly to privacy@thebride.app.",
  },
  ctaLabel: "Delete my account",
  ctaHref: "/settings/account",
  relatedLinks: [
    { href: "/legal/account-deletion", label: "Account Deletion Policy" },
    { href: "/legal/privacy", label: "Privacy Policy" },
  ],
  relatedTitle: "Related documents",
};

export default function DataDeletionPage() {
  const { lang } = useLanguage();
  const c = lang === "fr" ? fr : en;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [requestType, setRequestType] = useState("full_deletion");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    const { error } = await supabase.from("data_deletion_requests").insert([{
      full_name: name.trim(),
      email: email.trim().toLowerCase(),
      request_type: requestType,
      details: details.trim() || null,
    }]);

    setResult(error ? "error" : "success");
    setSubmitting(false);
    if (!error) {
      setName(""); setEmail(""); setDetails(""); setRequestType("full_deletion");
    }
  };

  const inputClass = "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100";

  return (
    <article className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{c.title}</h1>
        <p className="mt-1 text-sm text-gray-500">{c.updated}</p>
      </div>

      {c.sections.map((section) => (
        <section key={section.heading} className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">{section.heading}</h2>
          {section.body && (
            <p className="text-sm leading-relaxed text-gray-700">{section.body}</p>
          )}
          {"list" in section && section.list && (
            <ul className="space-y-2">
              {section.list.map((item, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-gray-700">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />{item}
                </li>
              ))}
            </ul>
          )}
          {"items" in section && section.items && (
            <ul className="space-y-2">
              {section.items.map((item, i) => (
                <li key={i} className="text-sm leading-relaxed text-gray-700">
                  <strong className="text-gray-900">{item.term} :</strong> {item.def}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {/* In-app CTA */}
      <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
        <p className="mb-3 text-sm font-semibold text-red-700">
          {lang === "fr" ? "Méthode la plus rapide" : "Fastest method"}
        </p>
        <Link
          href={c.ctaHref}
          className="inline-block rounded-full bg-red-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600"
        >
          {c.ctaLabel}
        </Link>
      </div>

      {/* Request form */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">{c.form.heading}</h2>

        {result === "success" && (
          <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{c.form.success}</div>
        )}
        {result === "error" && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{c.form.error}</div>
        )}

        {result !== "success" && (
          <form className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{c.form.nameLabel}</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={c.form.namePlaceholder} required className={inputClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{c.form.emailLabel}</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={c.form.emailPlaceholder} required className={inputClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{c.form.typeLabel}</label>
              <select value={requestType} onChange={(e) => setRequestType(e.target.value)} className={inputClass}>
                {c.form.typeOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{c.form.detailsLabel}</label>
              <textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} placeholder={c.form.detailsPlaceholder} className={inputClass} />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full brand-gradient-bg py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? c.form.submitting : c.form.submit}
            </button>
          </form>
        )}
      </section>

      <div className="rounded-xl border border-brand-200 bg-brand-50 px-5 py-4">
        <p className="mb-3 text-sm font-semibold text-brand-600">{c.relatedTitle}</p>
        <div className="flex flex-col gap-2">
          {c.relatedLinks.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm text-brand-600 underline underline-offset-2 hover:opacity-75">
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </article>
  );
}
