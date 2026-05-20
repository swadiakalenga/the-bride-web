"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { useLanguage } from "../../../lib/useLanguage";
import type { Lang } from "../../../lib/i18n";
import type { Profile } from "../../../lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  myProfile: Profile | null;
};

const LEGAL_LINKS = [
  { href: "/legal/terms",                    fr: "Conditions d'utilisation",    en: "Terms of Use" },
  { href: "/legal/privacy",                  fr: "Confidentialité",              en: "Privacy Policy" },
  { href: "/legal/community-guidelines",     fr: "Règles de la communauté",      en: "Community Guidelines" },
  { href: "/legal/church-verification-policy", fr: "Vérification des églises",   en: "Church Verification" },
  { href: "/legal/donation-policy",          fr: "Politique de dons",            en: "Donation Policy" },
  { href: "/legal/safety-reporting",         fr: "Sécurité & Signalement",       en: "Safety & Reporting" },
] as const;

export default function MobileMenuDrawer({ open, onClose, myProfile }: Props) {
  const router = useRouter();
  const { lang, setLang, t } = useLanguage();

  const isChurchAdmin = myProfile?.role === "church_admin";
  const isPlatformAdmin = myProfile?.role === "platform_admin";

  // Scroll lock + escape key
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const navigate = (path: string) => { onClose(); router.push(path); };

  const handleLogout = async () => {
    onClose();
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer — slides in from the right */}
      <aside
        className="fixed right-0 top-0 z-50 flex h-full w-72 max-w-[85vw] flex-col bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <span className="font-bold text-gray-900">TheBride</span>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
            aria-label={t("common_close")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">

          {/* Support */}
          <div className="px-3 pt-4 pb-2">
            <button
              onClick={() => navigate("/support")}
              className="flex w-full items-center gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 hover:bg-amber-100"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-amber-500">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              {t("support_button")}
            </button>
          </div>

          {/* Role-gated links */}
          {(isChurchAdmin || isPlatformAdmin) && (
            <div className="px-3 pb-2">
              {isChurchAdmin && myProfile?.church_id && (
                <button
                  onClick={() => navigate(`/church/${myProfile.church_id}/verify`)}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                    <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                  {t("church_verify_cta")}
                </button>
              )}
              {isPlatformAdmin && (
                <button
                  onClick={() => navigate("/admin")}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-purple-700 hover:bg-purple-50"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400">
                    <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {t("admin_platform")}
                </button>
              )}
            </div>
          )}

          {/* Language switcher */}
          <div className="border-t border-gray-100 px-5 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t("common_language")}</p>
            <div className="flex gap-2">
              {(["fr", "en"] as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold uppercase transition ${
                    lang === l ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Legal links */}
          <div className="border-t border-gray-100 px-3 py-2">
            <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {t("admin_settings_legal")}
            </p>
            {LEGAL_LINKS.map((l) => (
              <button
                key={l.href}
                onClick={() => navigate(l.href)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                {lang === "fr" ? l.fr : l.en}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            ))}
          </div>
        </div>

        {/* Footer — Logout */}
        <div className="border-t border-gray-100 p-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {t("profile_logout")}
          </button>
        </div>
      </aside>
    </>
  );
}
