"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useLanguage } from "../../lib/useLanguage";
import type { Lang } from "../../lib/i18n";
import Logo from "../components/ui/Logo";

type ResetState = "loading" | "invalid" | "form" | "success";

function PasswordStrengthBar({ password }: { password: string }) {
  const len = password.length;
  const score = len === 0 ? 0 : len < 8 ? 1 : len < 12 ? 2 : /[A-Z]/.test(password) && /[0-9]/.test(password) ? 4 : 3;
  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  const colors = ["", "bg-red-400", "bg-yellow-400", "bg-blue-400", "bg-green-400"];
  return (
    <div className="mt-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${score >= i ? colors[score] : "bg-gray-200"}`}
          />
        ))}
      </div>
      {password.length > 0 && (
        <p className={`mt-1 text-xs ${score <= 1 ? "text-red-500" : score <= 2 ? "text-yellow-600" : score <= 3 ? "text-blue-600" : "text-green-600"}`}>
          {labels[score]}
        </p>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const { lang, setLang, t } = useLanguage();

  const [state, setState] = useState<ResetState>("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Supabase puts the recovery token in the URL hash (#access_token=...&type=recovery)
    // The client SDK automatically exchanges it for a session on page load.
    // We check for the session type here.
    const checkSession = async () => {
      // Small delay to let Supabase SDK process the hash
      await new Promise((r) => setTimeout(r, 300));

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        setState("invalid");
        return;
      }

      // Supabase sets aud = "authenticated" and sets a recovery flag
      // The recovery session is valid if we got here via the email link
      setState("form");
    };

    checkSession();

    // Listen for auth state — if token exchange happens via onAuthStateChange
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setState("form");
      }
      if (event === "SIGNED_OUT") {
        setState("invalid");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError(t("reset_weak"));
      return;
    }

    if (password !== confirm) {
      setError(t("reset_mismatch"));
      return;
    }

    setSubmitting(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    setSubmitting(false);

    if (updateError) {
      if (updateError.message.toLowerCase().includes("expired") || updateError.message.toLowerCase().includes("invalid")) {
        setError(t("reset_invalid_link"));
      } else {
        setError(updateError.message);
      }
      return;
    }

    setState("success");

    // Sign out the recovery session and redirect to login
    setTimeout(async () => {
      await supabase.auth.signOut();
      router.push("/login");
    }, 2500);
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
      </div>

      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm border border-gray-100">
        {/* Loading */}
        {state === "loading" && (
          <div className="flex flex-col items-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-400 border-t-transparent" />
            <p className="mt-4 text-sm text-gray-500">{t("common_loading")}</p>
          </div>
        )}

        {/* Invalid link */}
        {state === "invalid" && (
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl">
              ⚠️
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              {lang === "fr" ? "Lien invalide" : "Invalid link"}
            </h2>
            <p className="mt-2 text-sm text-gray-500 leading-relaxed">
              {t("reset_invalid_link")}
            </p>
            <a
              href="/forgot-password"
              className="mt-6 inline-block rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
            >
              {lang === "fr" ? "Demander un nouveau lien" : "Request new link"}
            </a>
          </div>
        )}

        {/* Success */}
        {state === "success" && (
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">
              ✅
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              {lang === "fr" ? "Mot de passe mis à jour !" : "Password updated!"}
            </h2>
            <p className="mt-2 text-sm text-gray-500">{t("reset_success")}</p>
            <div className="mt-4 h-4 w-4 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
          </div>
        )}

        {/* Form */}
        {state === "form" && (
          <>
            <h2 className="mb-1 text-xl font-bold text-gray-900">{t("reset_title")}</h2>
            <p className="mb-6 text-sm text-gray-500 leading-relaxed">{t("reset_desc")}</p>

            <form className="space-y-4" onSubmit={handleSubmit}>
              {/* New password */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  {t("reset_password")}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 pr-10 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
                    required
                    autoComplete="new-password"
                    autoFocus
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                <PasswordStrengthBar password={password} />
              </div>

              {/* Confirm password */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  {t("reset_confirm")}
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full rounded-xl border bg-gray-50 px-4 py-3 text-sm outline-none transition focus:bg-white focus:ring-2 ${
                    confirm && confirm !== password
                      ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                      : "border-gray-200 focus:border-brand-400 focus:ring-brand-100"
                  }`}
                  required
                  autoComplete="new-password"
                />
                {confirm && confirm !== password && (
                  <p className="mt-1 text-xs text-red-500">{t("reset_mismatch")}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || password.length < 8 || password !== confirm}
                className="w-full rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:from-brand-600 hover:to-brand-700 disabled:opacity-50"
              >
                {submitting ? t("reset_submitting") : t("reset_submit")}
              </button>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-600">
                  {error}
                </p>
              )}
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              <a href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
                {t("forgot_back_login")}
              </a>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
