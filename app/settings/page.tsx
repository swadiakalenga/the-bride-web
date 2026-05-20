"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "../../lib/useLanguage";
import { supabase } from "../../lib/supabase";

const fr = {
  title: "Paramètres",
  sections: [
    {
      heading: "Compte",
      items: [
        { href: "/settings/account", label: "Compte et suppression", desc: "Gérer et supprimer votre compte", danger: true },
      ],
    },
    {
      heading: "Légal",
      items: [
        { href: "/legal", label: "Documents légaux", desc: "Politique, conditions, directives" },
        { href: "/legal/privacy", label: "Politique de confidentialité", desc: "Comment vos données sont utilisées" },
        { href: "/legal/terms", label: "Conditions d'utilisation", desc: "Règles de la plateforme" },
        { href: "/legal/data-deletion", label: "Demande de suppression de données", desc: "Exercer votre droit à l'effacement" },
      ],
    },
  ],
  signOut: "Se déconnecter",
};

const en = {
  title: "Settings",
  sections: [
    {
      heading: "Account",
      items: [
        { href: "/settings/account", label: "Account & Deletion", desc: "Manage and delete your account", danger: true },
      ],
    },
    {
      heading: "Legal",
      items: [
        { href: "/legal", label: "Legal Documents", desc: "Policies, terms, and guidelines" },
        { href: "/legal/privacy", label: "Privacy Policy", desc: "How your data is used" },
        { href: "/legal/terms", label: "Terms of Use", desc: "Platform rules" },
        { href: "/legal/data-deletion", label: "Data Deletion Request", desc: "Exercise your right to erasure" },
      ],
    },
  ],
  signOut: "Sign out",
};

export default function SettingsPage() {
  const { lang } = useLanguage();
  const c = lang === "fr" ? fr : en;
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{c.title}</h1>

      {c.sections.map((section) => (
        <div key={section.heading}>
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
            {section.heading}
          </p>
          <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            {section.items.map((item, i) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-5 py-4 transition-colors hover:bg-gray-50 ${
                  i > 0 ? "border-t border-gray-100" : ""
                }`}
              >
                <div>
                  <p className={`font-semibold ${(item as { danger?: boolean }).danger ? "text-red-600" : "text-gray-900"}`}>
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-sm text-gray-500">{item.desc}</p>
                </div>
                <svg
                  className={`ml-4 shrink-0 ${(item as { danger?: boolean }).danger ? "text-red-400" : "text-brand-600"}`}
                  width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      ))}

      <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <button
          onClick={handleSignOut}
          className="flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-gray-50"
        >
          <div>
            <p className="font-semibold text-gray-900">{c.signOut}</p>
          </div>
          <svg className="ml-4 shrink-0 text-gray-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
