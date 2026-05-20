"use client";

import Link from "next/link";
import { useLanguage } from "../../../lib/useLanguage";

const LEGAL_LINKS = [
  { href: "/legal/terms", labelFr: "Conditions d'utilisation", labelEn: "Terms of Use" },
  { href: "/legal/privacy", labelFr: "Politique de confidentialité", labelEn: "Privacy Policy" },
  { href: "/legal/community-guidelines", labelFr: "Règles de la communauté", labelEn: "Community Guidelines" },
  { href: "/legal/church-verification-policy", labelFr: "Politique de vérification", labelEn: "Verification Policy" },
  { href: "/legal/donation-policy", labelFr: "Politique de dons", labelEn: "Donation Policy" },
  { href: "/legal/safety-reporting", labelFr: "Sécurité & Signalement", labelEn: "Safety & Reporting" },
] as const;

export default function AdminSettingsPage() {
  const { lang, t } = useLanguage();

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">{t("admin_settings_title")}</h1>

      {/* Legal documents */}
      <section className="rounded-2xl bg-white p-5 shadow-sm space-y-1">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
          {t("admin_settings_legal")}
        </h2>
        {LEGAL_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            target="_blank"
            className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {lang === "fr" ? l.labelFr : l.labelEn}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </Link>
        ))}
      </section>

      {/* DM privacy notice */}
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm space-y-2">
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 shrink-0">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          <p className="font-semibold text-emerald-700">
            {lang === "fr" ? "Messages privés protégés" : "Private messages are protected"}
          </p>
        </div>
        <p className="text-emerald-700">
          {lang === "fr"
            ? "Les administrateurs de la plateforme ne peuvent pas lire les messages directs des utilisateurs. Les DMs sont accessibles uniquement aux participants de chaque conversation — cette restriction est appliquée au niveau de la base de données (RLS) et ne peut pas être contournée par l'interface admin."
            : "Platform admins cannot read users' direct messages. DMs are accessible only to conversation participants — this restriction is enforced at the database level (RLS) and cannot be bypassed through the admin interface."}
        </p>
        <p className="text-xs text-emerald-600">
          {lang === "fr"
            ? "Le tableau de bord admin peut afficher le nombre total de messages à des fins statistiques, mais pas leur contenu."
            : "The admin dashboard may show a total message count for statistics, but never message content."}
        </p>
      </section>

      {/* Platform admin note */}
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-700 space-y-1">
        <p className="font-semibold">Accès platform_admin</p>
        <p>Pour accorder l&apos;accès admin à un utilisateur, exécutez directement dans la base de données :</p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-white/60 px-3 py-2 text-xs font-mono text-gray-700">
{`UPDATE public.profiles
SET role = 'platform_admin'
WHERE id = '<uuid-utilisateur>';`}
        </pre>
        <p className="text-xs mt-1">Le rôle <code>platform_admin</code> ne peut pas être accordé via l&apos;interface — uniquement directement dans la DB.</p>
      </section>
    </div>
  );
}
