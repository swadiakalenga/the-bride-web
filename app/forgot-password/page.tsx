"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useLanguage } from "../../lib/useLanguage";
import type { Lang } from "../../lib/i18n";
import Logo from "../components/ui/Logo";

export default function ForgotPasswordPage() {
  const { lang, setLang, t } = useLanguage();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    setLoading(true);

    const { error: authError } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: "https://www.thebride.app/reset-password",
    });

    setLoading(false);

    if (authError) {
      // Never reveal whether an email exists — show generic error only for real failures
      if (authError.message.toLowerCase().includes("rate limit")) {
        setError(
          lang === "fr"
            ? "Trop de tentatives. Veuillez patienter quelques minutes."
            : "Too many attempts. Please wait a few minutes.",
        );
      } else {
        setError(
          lang === "fr"
            ? "Une erreur est survenue. Veuillez réessayer."
            : "Something went wrong. Please try again.",
        );
      }
      return;
    }

    // Always show success — never confirm whether the email exists (security best-practice)
    setSent(true);
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
              lang === l ? "bg-brand-100 text-brand-700" : "text-gray-400 hover:text-gray-700"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Logo */}
      <div className="mb-8 flex flex-col items-center">
        <Logo size="lg" />
        <p className="mt-3 text-sm text-gray-500">Connect. Worship. Grow together.</p>
      </div>

      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm border border-gray-100">
        {sent ? (
          /* ── Success state ── */
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">
              ✉️
            </div>
            <h2 className="text-xl font-bold text-gray-900">{t("forgot_success_title")}</h2>
            <p className="mt-2 text-sm text-gray-500 leading-relaxed">{t("forgot_success_desc")}</p>
            <a
              href="/login"
              className="mt-6 inline-block rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
            >
              {t("forgot_back_login")}
            </a>
          </div>
        ) : (
          /* ── Form state ── */
          <>
            <h2 className="mb-1 text-xl font-bold text-gray-900">{t("forgot_title")}</h2>
            <p className="mb-6 text-sm text-gray-500 leading-relaxed">{t("forgot_desc")}</p>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  {t("forgot_email")}
                </label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:from-brand-600 hover:to-brand-700 disabled:opacity-60"
              >
                {loading ? t("forgot_sending") : t("forgot_submit")}
              </button>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-600">
                  {error}
                </p>
              )}
            </form>
          </>
        )}
      </div>

      <p className="mt-6 text-sm text-gray-500">
        <a href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
          {t("forgot_back_login")}
        </a>
      </p>
    </main>
  );
}
