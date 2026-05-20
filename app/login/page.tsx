"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useLanguage } from "../../lib/useLanguage";
import type { Lang } from "../../lib/i18n";
import Logo from "../components/ui/Logo";

export default function LoginPage() {
  const { lang, setLang, t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    window.location.href = "/feed";
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      {/* Language picker */}
      <div className="absolute right-4 top-4 flex gap-1">
        {(["fr", "en"] as Lang[]).map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={`rounded px-2 py-1 text-xs font-semibold uppercase ${
              lang === l ? "bg-amber-100 text-amber-700" : "text-gray-400 hover:text-gray-700"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Logo area */}
      <div className="mb-8 flex flex-col items-center">
        <Logo size="lg" />
        <p className="mt-3 text-sm text-gray-500">Connect. Worship. Grow together.</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm border border-gray-100">
        <h2 className="mb-1 text-xl font-bold text-gray-900">{t("login_title")}</h2>
        <p className="mb-6 text-sm text-gray-500">TheBride</p>

        <form className="space-y-4" onSubmit={handleLogin}>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">{t("login_email")}</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
              required
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">{t("login_password")}</label>
              <a href="/forgot-password" className="text-xs font-medium text-brand-600 hover:text-brand-700">
                {t("forgot_link")}
              </a>
            </div>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:from-brand-600 hover:to-brand-700 disabled:opacity-60"
          >
            {loading ? "…" : t("login_submit")}
          </button>

          {message && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-600">
              {message}
            </p>
          )}
        </form>
      </div>

      <p className="mt-6 text-sm text-gray-500">
        {t("login_no_account")}{" "}
        <a href="/register" className="font-semibold text-brand-600 hover:text-brand-700">
          {t("login_register_link")}
        </a>
      </p>
    </main>
  );
}
