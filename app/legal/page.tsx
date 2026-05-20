"use client";

import Link from "next/link";
import { useLanguage } from "../../lib/useLanguage";

const fr = {
  title: "Documents légaux",
  subtitle: "Politiques et conditions de TheBride",
  docs: [
    { href: "/legal/privacy", title: "Politique de confidentialité", desc: "Comment nous collectons, utilisons et protégeons vos données." },
    { href: "/legal/terms", title: "Conditions d'utilisation", desc: "Règles et responsabilités pour l'utilisation de la plateforme." },
    { href: "/legal/community-guidelines", title: "Charte communautaire", desc: "Ce qui est encouragé et ce qui est interdit sur TheBride." },
    { href: "/legal/safety-reporting", title: "Politique de sécurité et signalement", desc: "Comment signaler des abus et comment nous y répondons." },
    { href: "/legal/donation-policy", title: "Politique de dons et paiements", desc: "Dons à la plateforme, dîmes et offrandes aux églises." },
    { href: "/legal/church-verification-policy", title: "Politique de vérification des églises", desc: "Processus et exigences pour les comptes d'église vérifiés." },
    { href: "/legal/account-deletion", title: "Politique de suppression de compte", desc: "Comment supprimer votre compte et ce qui se passe à vos données." },
    { href: "/legal/data-deletion", title: "Demande de suppression de données", desc: "Exercer votre droit à l'effacement et comment soumettre une demande." },
  ],
};

const en = {
  title: "Legal Documents",
  subtitle: "TheBride Policies & Terms",
  docs: [
    { href: "/legal/privacy", title: "Privacy Policy", desc: "How we collect, use, and protect your data." },
    { href: "/legal/terms", title: "Terms of Use", desc: "Rules and responsibilities for using the platform." },
    { href: "/legal/community-guidelines", title: "Community Guidelines", desc: "What is encouraged and what is prohibited on TheBride." },
    { href: "/legal/safety-reporting", title: "Safety & Reporting Policy", desc: "How to report abuse and how we respond." },
    { href: "/legal/donation-policy", title: "Donation & Payment Policy", desc: "Platform donations, tithes, and church offerings." },
    { href: "/legal/church-verification-policy", title: "Church Verification Policy", desc: "Process and requirements for verified church accounts." },
    { href: "/legal/account-deletion", title: "Account Deletion Policy", desc: "How to delete your account and what happens to your data." },
    { href: "/legal/data-deletion", title: "Data Deletion Request", desc: "Exercise your right to erasure and how to submit a request." },
  ],
};

export default function LegalIndexPage() {
  const { lang } = useLanguage();
  const c = lang === "fr" ? fr : en;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-gray-900">{c.title}</h1>
      <p className="mb-8 text-sm text-gray-500">{c.subtitle}</p>
      <div className="flex flex-col gap-3">
        {c.docs.map((doc) => (
          <Link
            key={doc.href}
            href={doc.href}
            className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm transition-colors hover:border-brand-200 hover:bg-brand-50"
          >
            <div>
              <p className="font-semibold text-gray-900">{doc.title}</p>
              <p className="mt-0.5 text-sm text-gray-500">{doc.desc}</p>
            </div>
            <svg className="ml-4 shrink-0 text-brand-600" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  );
}
