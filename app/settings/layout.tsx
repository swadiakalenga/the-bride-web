"use client";

import { useRouter } from "next/navigation";
import { useLanguage } from "../../lib/useLanguage";

const labels = {
  fr: { back: "Retour", title: "Paramètres" },
  en: { back: "Back", title: "Settings" },
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { lang, setLang } = useLanguage();
  const c = labels[lang] ?? labels.en;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
            aria-label={c.back}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-brand-600">TheBride</span>
          <span className="text-sm text-gray-400">·</span>
          <span className="text-sm text-gray-500">{c.title}</span>
          <div className="ml-auto flex items-center rounded-full border border-gray-200 bg-gray-50 p-0.5 text-xs font-semibold">
            <button
              onClick={() => setLang("fr")}
              className={`rounded-full px-3 py-1 transition-colors ${lang === "fr" ? "bg-brand-600 text-white" : "text-gray-500 hover:text-gray-700"}`}
            >
              FR
            </button>
            <button
              onClick={() => setLang("en")}
              className={`rounded-full px-3 py-1 transition-colors ${lang === "en" ? "bg-brand-600 text-white" : "text-gray-500 hover:text-gray-700"}`}
            >
              EN
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8 pb-20">
        {children}
      </div>
    </div>
  );
}
