"use client";

import { useEffect, useState } from "react";
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
  { href: "/legal/terms",                      fr: "Conditions d'utilisation",  en: "Terms of Use" },
  { href: "/legal/privacy",                    fr: "Confidentialité",            en: "Privacy Policy" },
  { href: "/legal/community-guidelines",       fr: "Règles de la communauté",    en: "Community Guidelines" },
  { href: "/legal/church-verification-policy", fr: "Vérification des églises",   en: "Church Verification" },
  { href: "/legal/donation-policy",            fr: "Politique de dons",          en: "Donation Policy" },
  { href: "/legal/safety-reporting",           fr: "Sécurité & Signalement",     en: "Safety & Reporting" },
] as const;

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gray-300">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function MenuItem({
  onClick,
  icon,
  label,
  chevron = false,
  className = "",
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  chevron?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${className}`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {chevron && <ChevronRight />}
    </button>
  );
}

export default function MobileMenuDrawer({ open, onClose, myProfile }: Props) {
  const router = useRouter();
  const { lang, setLang, t } = useLanguage();
  const [panel, setPanel] = useState<"main" | "settings">("main");

  // Role checks — explicit equality so there is no ambiguity
  const isPlatformAdmin = myProfile?.role === "platform_admin";
  const isChurchAdmin   = myProfile?.role === "church_admin";

  // Reset to main panel when drawer closes
  useEffect(() => {
    if (!open) setPanel("main");
  }, [open]);

  // Scroll lock + Escape key
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (panel === "settings") setPanel("main");
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, panel, onClose]);

  if (!open) return null;

  const navigate = (path: string) => { onClose(); router.push(path); };

  const handleLogout = async () => {
    onClose();
    await supabase.auth.signOut();
    router.replace("/login");
  };

  // ─── Icons ────────────────────────────────────────────────────────────────
  const IconHeart = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-amber-500">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
  const IconSettings = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
      <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
  const IconAdmin = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
  const IconVerify = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
      <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    </svg>
  );
  const IconLogout = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} aria-hidden="true" />

      {/* Drawer */}
      <aside
        className="fixed right-0 top-0 z-50 flex h-full w-72 max-w-[85vw] flex-col bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={panel === "settings" ? t("admin_nav_settings") : "Menu"}
      >
        {/* ── MAIN PANEL ─────────────────────────────────────────────────── */}
        {panel === "main" && (
          <>
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

            {/* Menu items */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
              {/* Donate — everyone */}
              <MenuItem
                onClick={() => navigate("/support")}
                icon={IconHeart}
                label={t("support_button")}
                className="bg-amber-50 text-amber-700 hover:bg-amber-100"
              />

              {/* Settings — everyone */}
              <MenuItem
                onClick={() => setPanel("settings")}
                icon={IconSettings}
                label={t("admin_nav_settings")}
                chevron
                className="text-gray-700 hover:bg-gray-50"
              />

              {/*
               * Platform Admin — ONLY rendered when role === "platform_admin".
               * isChurchAdmin is false for platform_admin (roles are exclusive),
               * and isPlatformAdmin is false for church_admin and member.
               */}
              {isPlatformAdmin && (
                <MenuItem
                  onClick={() => navigate("/admin")}
                  icon={IconAdmin}
                  label={t("admin_platform")}
                  className="text-purple-700 hover:bg-purple-50"
                />
              )}

              {/*
               * Church Verification — ONLY rendered when role === "church_admin"
               * and the user is linked to a church.
               */}
              {isChurchAdmin && myProfile?.church_id && (
                <MenuItem
                  onClick={() => navigate(`/church/${myProfile.church_id}/verify`)}
                  icon={IconVerify}
                  label={t("church_verify_cta")}
                  className="text-gray-700 hover:bg-gray-50"
                />
              )}
            </div>

            {/* Footer — Sign out */}
            <div className="border-t border-gray-100 px-3 py-4">
              <MenuItem
                onClick={handleLogout}
                icon={IconLogout}
                label={t("profile_logout")}
                className="text-red-500 hover:bg-red-50"
              />
            </div>
          </>
        )}

        {/* ── SETTINGS PANEL ─────────────────────────────────────────────── */}
        {panel === "settings" && (
          <>
            {/* Header with back button */}
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-4">
              <button
                onClick={() => setPanel("main")}
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
                aria-label={t("common_back")}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <span className="font-bold text-gray-900">{t("admin_nav_settings")}</span>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Language switcher */}
              <div className="px-5 py-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {t("common_language")}
                </p>
                <div className="flex gap-2">
                  {(["fr", "en"] as Lang[]).map((l) => (
                    <button
                      key={l}
                      onClick={() => setLang(l)}
                      className={`flex-1 rounded-lg py-2 text-sm font-semibold uppercase transition ${
                        lang === l
                          ? "bg-amber-100 text-amber-700"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
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
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {lang === "fr" ? l.fr : l.en}
                    <ChevronRight />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
