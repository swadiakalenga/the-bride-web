"use client";

import { useCallback, useEffect, useState } from "react";
import { type Lang, t as rawT, type TranslationKey } from "./i18n";

const STORAGE_KEY = "tb_lang";
const DEFAULT_LANG: Lang = "fr";

export function useLanguage() {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (stored === "fr" || stored === "en") {
      setLangState(stored);
    }
  }, []);

  const setLang = useCallback((next: Lang) => {
    localStorage.setItem(STORAGE_KEY, next);
    setLangState(next);
  }, []);

  const t = useCallback(
    (key: TranslationKey, ...args: unknown[]) => rawT(lang, key, ...args),
    [lang]
  );

  return { lang, setLang, t };
}
