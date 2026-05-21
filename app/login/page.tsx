"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useLanguage } from "../../lib/useLanguage";
import type { Lang } from "../../lib/i18n";
import Logo from "../components/ui/Logo";

type LoginMode = "password" | "otp";

const RESEND_COOLDOWN = 60;

export default function LoginPage() {
  const { lang, setLang, t } = useLanguage();

  const [mode,     setMode]    = useState<LoginMode>("password");
  const [email,    setEmail]   = useState("");
  const [password, setPassword] = useState("");
  const [code,     setCode]    = useState("");
  const [message,  setMessage] = useState("");
  const [isError,  setIsError] = useState(false);
  const [loading,  setLoading] = useState(false);

  // OTP state
  const [codeSent,     setCodeSent]     = useState(false);
  const [resendSecs,   setResendSecs]   = useState(0);
  const resendTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (resendTimer.current) clearInterval(resendTimer.current); };
  }, []);

  const startResendTimer = () => {
    setResendSecs(RESEND_COOLDOWN);
    resendTimer.current = setInterval(() => {
      setResendSecs((s) => {
        if (s <= 1) { clearInterval(resendTimer.current!); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  const switchMode = (m: LoginMode) => {
    setMode(m);
    setMessage("");
    setIsError(false);
    setCodeSent(false);
    setCode("");
  };

  // ── Password login ────────────────────────────────────────────────────────
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

    if (error) {
      setMessage(error.message);
      setIsError(true);
      setLoading(false);
      return;
    }

    window.location.href = "/feed";
  };

  // ── Email OTP — send code ─────────────────────────────────────────────────
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setMessage("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });

    setLoading(false);

    if (error) {
      // Supabase returns a generic error when the email doesn't exist and
      // shouldCreateUser = false. Surface a clear message.
      const raw = error.message.toLowerCase();
      if (raw.includes("email not confirmed") || raw.includes("user not found") || raw.includes("signups not allowed")) {
        setMessage(t("login_code_error_no_account"));
      } else {
        setMessage(error.message);
      }
      setIsError(true);
      return;
    }

    setCodeSent(true);
    setIsError(false);
    setMessage(t("login_code_sent"));
    startResendTimer();
  };

  // ── Email OTP — verify code ───────────────────────────────────────────────
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6,8}$/.test(code)) return;
    setMessage("");
    setLoading(true);

    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type:  "email",
    });

    if (error) {
      const raw = error.message.toLowerCase();
      const msg = (raw.includes("expired") || raw.includes("invalid") || raw.includes("otp"))
        ? t("login_code_error_invalid")
        : error.message;
      setMessage(msg);
      setIsError(true);
      setLoading(false);
      return;
    }

    window.location.href = "/feed";
  };

  const handleResend = () => {
    if (resendSecs > 0) return;
    setCodeSent(false);
    setCode("");
    setMessage("");
    setIsError(false);
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

      {/* Logo */}
      <div className="mb-8 flex flex-col items-center">
        <Logo size="lg" />
        <p className="mt-3 text-sm text-gray-500">Connect. Worship. Grow together.</p>
      </div>

      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm border border-gray-100">
        <h2 className="mb-4 text-xl font-bold text-gray-900">{t("login_title")}</h2>

        {/* Mode tabs */}
        <div className="mb-6 flex rounded-xl border border-gray-200 bg-gray-50 p-1">
          <button
            type="button"
            onClick={() => switchMode("password")}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              mode === "password"
                ? "bg-white shadow-sm text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t("login_with_password")}
          </button>
          <button
            type="button"
            onClick={() => switchMode("otp")}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              mode === "otp"
                ? "bg-white shadow-sm text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t("login_with_code")}
          </button>
        </div>

        {/* ── Password form ───────────────────────────────────────────── */}
        {mode === "password" && (
          <form className="space-y-4" onSubmit={handlePasswordLogin}>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{t("login_email")}</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
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
                required
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
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
              <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-600">{message}</p>
            )}
          </form>
        )}

        {/* ── Email OTP form ──────────────────────────────────────────── */}
        {mode === "otp" && (
          <div className="space-y-4">
            {/* Step 1 — enter email and send code */}
            {!codeSent ? (
              <form onSubmit={handleSendCode} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">{t("login_email")}</label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:from-brand-600 hover:to-brand-700 disabled:opacity-60"
                >
                  {loading ? t("login_sending_code") : t("login_send_code")}
                </button>
                {message && (
                  <p className={`rounded-lg px-3 py-2 text-center text-sm ${isError ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
                    {message}
                  </p>
                )}
              </form>
            ) : (
              /* Step 2 — enter the verification code */
              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">
                  {t("login_code_sent")}
                  <span className="block font-medium">{email}</span>
                </div>

                {/* Template setup note — shown if email arrived as a link instead of code */}
                <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5 text-xs text-amber-800">
                  {lang === "fr"
                    ? "Si vous avez reçu un lien plutôt qu'un code de vérification, le modèle d'e-mail Supabase doit être mis à jour. Contactez votre administrateur."
                    : "If you received a link instead of a verification code, the Supabase email template needs updating. Contact your administrator."}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    {t("login_enter_code")}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6,8}"
                    maxLength={8}
                    placeholder="00000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").trimStart())}
                    required
                    autoFocus
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !/^\d{6,8}$/.test(code)}
                  className="w-full rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:from-brand-600 hover:to-brand-700 disabled:opacity-60"
                >
                  {loading ? t("login_verifying") : t("login_verify_code")}
                </button>

                {message && (
                  <p className={`rounded-lg px-3 py-2 text-center text-sm ${isError ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
                    {message}
                  </p>
                )}

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendSecs > 0}
                    className="font-medium text-brand-600 hover:text-brand-700 disabled:cursor-not-allowed disabled:text-gray-400"
                  >
                    {resendSecs > 0
                      ? t("login_resend_wait", resendSecs)
                      : t("login_resend_code")}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCodeSent(false); setCode(""); setMessage(""); setIsError(false); }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {t("common_back")}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
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
