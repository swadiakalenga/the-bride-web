"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "../../lib/useLanguage";
import { supabase } from "../../lib/supabase";

export default function SettingsPage() {
  const { lang } = useLanguage();
  const router = useRouter();
  const isFr = lang === "fr";

  const [churchId, setChurchId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, church_id")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.role === "church_admin" && profile?.church_id) {
        setChurchId(profile.church_id);
      }
    })();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">
        {isFr ? "Paramètres" : "Settings"}
      </h1>

      {/* ── Church Admin section — only visible to church admins ── */}
      {churchId && (
        <div>
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
            {isFr ? "Administration" : "Church Admin"}
          </p>
          <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <Link
              href={`/church/${churchId}/live/manage`}
              className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-gray-50"
            >
              <div>
                <p className="font-semibold text-gray-900">
                  📺 {isFr ? "Gérer le live" : "Manage Live"}
                </p>
                <p className="mt-0.5 text-sm text-gray-500">
                  {isFr
                    ? "Diffuser en direct, planifier et gérer les replays"
                    : "Go live, schedule streams, and manage replays"}
                </p>
              </div>
              <svg
                className="ml-4 shrink-0 text-gray-400"
                width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </Link>
          </div>
        </div>
      )}

      {/* ── Account ── */}
      <div>
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
          {isFr ? "Compte" : "Account"}
        </p>
        <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <Link
            href="/settings/account"
            className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-gray-50"
          >
            <div>
              <p className="font-semibold text-red-600">
                {isFr ? "Compte et suppression" : "Account & Deletion"}
              </p>
              <p className="mt-0.5 text-sm text-gray-500">
                {isFr ? "Gérer et supprimer votre compte" : "Manage and delete your account"}
              </p>
            </div>
            <svg className="ml-4 shrink-0 text-red-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
          <Link
            href="/settings/payment-methods"
            className="flex items-center justify-between border-t border-gray-100 px-5 py-4 transition-colors hover:bg-gray-50"
          >
            <div>
              <p className="font-semibold text-gray-900">
                {isFr ? "Moyens de paiement" : "Payment Methods"}
              </p>
              <p className="mt-0.5 text-sm text-gray-500">
                {isFr ? "Gérer vos cartes enregistrées" : "Manage your saved cards"}
              </p>
            </div>
            <svg className="ml-4 shrink-0 text-brand-600" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        </div>
      </div>

      {/* ── Legal ── */}
      <div>
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
          {isFr ? "Légal" : "Legal"}
        </p>
        <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {[
            { href: "/legal",               en: "Legal Documents",        fr: "Documents légaux",                  descEn: "Policies, terms, and guidelines",        descFr: "Politique, conditions, directives" },
            { href: "/legal/privacy",        en: "Privacy Policy",         fr: "Politique de confidentialité",      descEn: "How your data is used",                  descFr: "Comment vos données sont utilisées" },
            { href: "/legal/terms",          en: "Terms of Use",           fr: "Conditions d'utilisation",          descEn: "Platform rules",                         descFr: "Règles de la plateforme" },
            { href: "/legal/data-deletion",  en: "Data Deletion Request",  fr: "Demande de suppression de données", descEn: "Exercise your right to erasure",          descFr: "Exercer votre droit à l'effacement" },
          ].map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-5 py-4 transition-colors hover:bg-gray-50 ${i > 0 ? "border-t border-gray-100" : ""}`}
            >
              <div>
                <p className="font-semibold text-gray-900">{isFr ? item.fr : item.en}</p>
                <p className="mt-0.5 text-sm text-gray-500">{isFr ? item.descFr : item.descEn}</p>
              </div>
              <svg className="ml-4 shrink-0 text-brand-600" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Sign out ── */}
      <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <button
          onClick={handleSignOut}
          className="flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-gray-50"
        >
          <p className="font-semibold text-gray-900">
            {isFr ? "Se déconnecter" : "Sign out"}
          </p>
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
