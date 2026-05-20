"use client";

import { usePathname, useRouter } from "next/navigation";
import type { Profile } from "../../../lib/types";
import { useLanguage } from "../../../lib/useLanguage";
import type { Lang } from "../../../lib/i18n";
import Button from "../ui/Button";
import Card from "../ui/Card";

type Props = {
  myProfile: Profile | null;
  myAvatar?: string | null;
  unreadCount: number;
  onCompose: () => void;
};

export default function LeftSidebar({ myProfile, myAvatar, unreadCount, onCompose }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { lang, setLang, t } = useLanguage();

  const myName = myProfile?.full_name || t("nav_profile");
  const isChurchAdmin = myProfile?.role === "church_admin";

  const navLinks = [
    {
      label: t("nav_home"),
      path: "/feed",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
          <path d="M9 21V12h6v9" />
        </svg>
      ),
    },
    {
      label: t("nav_search"),
      path: "/search",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      ),
    },
    {
      label: t("nav_alerts"),
      path: "/notifications",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
      ),
    },
    {
      label: t("nav_messages"),
      path: "/messages",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      ),
    },
    {
      label: t("nav_profile"),
      path: "/profile",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      {/* Profile mini-card */}
      <Card>
        <button
          onClick={() => router.push("/profile")}
          className="flex w-full items-center gap-3 text-left"
        >
          {myAvatar ? (
            <img
              src={myAvatar}
              alt={myName}
              className="h-12 w-12 rounded-full border-2 border-amber-400 object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border-2 border-amber-400 bg-amber-50 text-base font-bold text-amber-600">
              {myName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-gray-900">{myName}</p>
            <span
              className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                isChurchAdmin ? "bg-brand-50 text-brand-600" : "bg-amber-50 text-amber-600"
              }`}
            >
              {isChurchAdmin ? t("profile_church_admin") : t("profile_member")}
            </span>
          </div>
        </button>
      </Card>

      {/* Nav links */}
      <Card className="p-2">
        <nav className="space-y-0.5">
          {navLinks.map((link) => {
            const active = pathname.startsWith(link.path);
            return (
              <button
                key={link.path}
                onClick={() => router.push(link.path)}
                className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active ? "bg-amber-50 text-amber-600" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span className={active ? "text-amber-500" : "text-gray-400"}>{link.icon}</span>
                {link.label}
                {link.label === t("nav_alerts") && unreadCount > 0 && (
                  <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </Card>

      {/* Create Post */}
      <Button onClick={onCompose} className="w-full justify-center">
        {t("feed_create_post")}
      </Button>

      {/* Support TheBride */}
      <button
        onClick={() => router.push("/support")}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
        {t("support_button")}
      </button>

      {/* Language switcher */}
      <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
        <span>{t("common_language")}:</span>
        {(["fr", "en"] as Lang[]).map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={`rounded px-2 py-0.5 font-medium uppercase transition ${
              lang === l
                ? "bg-amber-100 text-amber-700"
                : "hover:text-gray-600"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}
