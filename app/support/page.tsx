"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { supabase } from "../../lib/supabase";
import { useLanguage } from "../../lib/useLanguage";

const PayPalButton = dynamic(() => import("../components/payments/PayPalButton"), { ssr: false });

type PaymentSetting = {
  id: string;
  method: string;
  label: string | null;
  config: Record<string, unknown>;
  instructions: string | null;
};

type Method = "paypal" | "mobile_money" | "bank" | "stripe";

const CURRENCIES = ["USD", "EUR", "GBP", "NGN", "KES", "ZAR", "GHS", "XAF", "XOF"];

/** True for both string "true" and boolean true — JSONB can return either */
function isTruthy(val: unknown): boolean {
  return val === "true" || val === true;
}

export default function SupportPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const isFr = lang === "fr";

  const [methods, setMethods]               = useState<PaymentSetting[]>([]);
  const [userId, setUserId]                 = useState<string | null>(null);
  const [loadingMethods, setLoadingMethods] = useState(true);

  const [selectedMethod, setSelectedMethod] = useState<string>("");
  const [amount, setAmount]                 = useState("");
  const [currency, setCurrency]             = useState("USD");
  const [reference, setReference]           = useState("");
  const [note, setNote]                     = useState("");
  const [submitting, setSubmitting]         = useState(false);
  const [success, setSuccess]               = useState(false);
  const [formError, setFormError]           = useState("");
  const [paypalSuccess, setPaypalSuccess]   = useState<{ donationId: string; captureId: string } | null>(null);
  const [paypalError, setPaypalError]       = useState("");

  // ── Derived guards ────────────────────────────────────────────────────────
  const paypalSetting     = methods.find((m) => m.method === "paypal");
  // Safe against both string "true" and boolean true from Supabase JSONB
  const paypalCheckoutOn  = isTruthy(paypalSetting?.config?.checkout_enabled);
  const hasPaypalClientId = !!process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  // PayPal is NEVER a manual method — excluded regardless of checkout_enabled
  const manualMethods     = methods.filter((m) => m.method !== "paypal");

  const load = useCallback(async () => {
    const [authRes, methodsRes] = await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from("payment_settings")
        .select("id, method, label, config, instructions")
        .eq("owner_type", "platform")
        .eq("enabled", true),
    ]);
    setUserId(authRes.data.user?.id ?? null);
    const loaded = (methodsRes.data as PaymentSetting[]) ?? [];
    setMethods(loaded);
    // Default selection: first non-PayPal method (PayPal uses its own checkout panel)
    const firstManual = loaded.find((m) => m.method !== "paypal");
    if (firstManual) setSelectedMethod(firstManual.method);
    else if (loaded.length > 0) setSelectedMethod(loaded[0].method);
    setLoadingMethods(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!userId) { router.push("/login"); return; }
    // Hard block — PayPal is never manual, regardless of checkout_enabled state
    if (selectedMethod === "paypal") {
      setFormError(
        isFr
          ? "PayPal doit être complété via le bouton PayPal sécurisé ci-dessus."
          : "PayPal must be completed using secure PayPal Checkout."
      );
      return;
    }
    if (!selectedMethod || !amount || parseFloat(amount) <= 0) return;
    setSubmitting(true);
    setFormError("");

    const { error } = await supabase.from("donations").insert([{
      donor_id:    userId,
      target_type: "platform",
      target_id:   null,
      amount:      parseFloat(amount),
      currency,
      method:      selectedMethod,
      status:      "pending",
      reference:   reference || null,
      note:        note || null,
    }]);

    setSubmitting(false);
    if (error) { setFormError(error.message); return; }
    setSuccess(true);
    setAmount(""); setReference(""); setNote("");
  };

  const methodName = (m: string): string => {
    const map: Record<string, string> = {
      paypal:       t("pay_method_paypal"),
      mobile_money: t("pay_method_mobile"),
      bank:         t("pay_method_bank"),
      stripe:       t("pay_method_card"),
    };
    return map[m] ?? m;
  };

  const renderMethodDetails = (setting: PaymentSetting) => {
    const cfg = setting.config as Record<string, string>;
    const m = setting.method as Method;
    return (
      <div className="mt-3 space-y-2 text-sm">
        {m === "paypal" && (
          <>
            {cfg.email && (
              <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span className="text-gray-500">Email</span>
                <a href={`mailto:${cfg.email}`} className="font-medium text-amber-600 hover:underline">{cfg.email}</a>
              </div>
            )}
            {cfg.link && (
              <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2">
                <span className="text-gray-500">PayPal.me</span>
                <a href={cfg.link} target="_blank" rel="noopener noreferrer" className="font-medium text-amber-600 hover:underline">{cfg.link}</a>
              </div>
            )}
          </>
        )}
        {m === "mobile_money" && (
          <>
            {cfg.provider && <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2"><span className="text-gray-500">{isFr ? "Opérateur" : "Provider"}</span><span className="font-medium text-gray-900">{cfg.provider}</span></div>}
            {cfg.name     && <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2"><span className="text-gray-500">{isFr ? "Nom" : "Name"}</span><span className="font-medium text-gray-900">{cfg.name}</span></div>}
            {cfg.phone    && <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2"><span className="text-gray-500">{isFr ? "Numéro" : "Phone"}</span><span className="font-mono font-medium text-gray-900">{cfg.phone}</span></div>}
            {cfg.country  && <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2"><span className="text-gray-500">{isFr ? "Pays" : "Country"}</span><span className="font-medium text-gray-900">{cfg.country}</span></div>}
          </>
        )}
        {m === "bank" && (
          <>
            {cfg.bank_name      && <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2"><span className="text-gray-500">{isFr ? "Banque" : "Bank"}</span><span className="font-medium text-gray-900">{cfg.bank_name}</span></div>}
            {cfg.account_name   && <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2"><span className="text-gray-500">{isFr ? "Titulaire" : "Account name"}</span><span className="font-medium text-gray-900">{cfg.account_name}</span></div>}
            {cfg.account_number && <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2"><span className="text-gray-500">{isFr ? "Numéro" : "Account no."}</span><span className="font-mono font-medium text-gray-900">{cfg.account_number}</span></div>}
            {cfg.routing_iban   && <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2"><span className="text-gray-500">IBAN / Routing</span><span className="font-mono font-medium text-gray-900">{cfg.routing_iban}</span></div>}
            {cfg.swift          && <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2"><span className="text-gray-500">SWIFT / BIC</span><span className="font-mono font-medium text-gray-900">{cfg.swift}</span></div>}
          </>
        )}
        {m === "stripe" && (
          <div className="rounded-lg bg-brand-50 px-3 py-2.5 text-xs text-brand-700">
            {t("pay_admin_stripe_note")}
          </div>
        )}
        {setting.instructions && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{setting.instructions}</p>
        )}
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3 shadow-sm">
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
          aria-label={t("common_back")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className="font-bold text-gray-900">{t("support_title")}</h1>
      </header>

      <div className="mx-auto max-w-lg px-4 py-8 space-y-6">

        {/* ── DEBUG PANEL — remove before final production deploy ─────────── */}
        {!loadingMethods && (
          <div className="rounded-xl border-2 border-red-400 bg-red-50 p-4 font-mono text-xs space-y-1">
            <p className="font-bold text-red-700">DEBUG (remove before deploy)</p>
            <p>methods count: {methods.length}</p>
            <p>paypalSetting id: {paypalSetting?.id ?? "none"}</p>
            <p>config.checkout_enabled: {JSON.stringify(paypalSetting?.config?.checkout_enabled)}</p>
            <p>paypalCheckoutOn: {String(paypalCheckoutOn)}</p>
            <p>hasPaypalClientId: {String(hasPaypalClientId)}</p>
            <p>manualMethods count: {manualMethods.length}</p>
            <p>manualMethods: [{manualMethods.map((m) => m.method).join(", ") || "none"}]</p>
            <p>selectedMethod: {selectedMethod || "(empty)"}</p>
          </div>
        )}
        {/* ── END DEBUG ─────────────────────────────────────────────────────── */}

        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 p-6 text-center text-white shadow-lg">
          <div className="mb-3 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </div>
          </div>
          <h2 className="text-xl font-bold">{t("support_title")}</h2>
          <p className="mt-2 text-sm text-amber-100">{t("support_tagline")}</p>
        </div>

        {/* Why support */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-bold text-gray-900">
            {isFr ? "Pourquoi nous soutenir ?" : "Why support us?"}
          </h3>
          <ul className="space-y-2 text-sm text-gray-600">
            {(isFr ? [
              "Maintenir et améliorer la plateforme TheBride",
              "Développer de nouvelles fonctionnalités pour les églises",
              "Héberger des données en toute sécurité pour les communautés chrétiennes",
              "Garder TheBride gratuit pour tous les membres",
            ] : [
              "Maintain and improve the TheBride platform",
              "Build new features for churches",
              "Securely host data for Christian communities",
              "Keep TheBride free for all members",
            ]).map((item) => (
              <li key={item} className="flex items-start gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Payment method info cards */}
        <div className="space-y-3">
          <h3 className="font-bold text-gray-900">
            {isFr ? "Comment faire un don" : "How to donate"}
          </h3>

          {loadingMethods ? (
            <div className="flex h-20 items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
            </div>
          ) : methods.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
              <p className="text-sm text-gray-400">{t("pay_no_methods")}</p>
              <a href="mailto:support@thebride.app" className="mt-2 inline-block text-sm font-semibold text-amber-600 hover:underline">
                support@thebride.app
              </a>
            </div>
          ) : (
            methods.map((setting) => (
              <div key={setting.id} className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <h4 className="font-semibold text-gray-900">
                    {setting.label || methodName(setting.method)}
                  </h4>
                </div>
                {renderMethodDetails(setting)}
              </div>
            ))
          )}
        </div>

        {/* ── PayPal section ─────────────────────────────────────────────────
            Shows whenever PayPal is an enabled method.
            Content depends on whether checkout is properly configured.
        ─────────────────────────────────────────────────────────────────── */}
        {paypalSetting && !paypalSuccess && (
          <div className="rounded-2xl bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0070ba" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
              <h3 className="font-bold text-gray-900">
                {isFr ? "Payer avec PayPal" : "Pay with PayPal"}
              </h3>
            </div>

            {!paypalCheckoutOn ? (
              /* checkout_enabled is false/missing — admin hasn't activated it */
              <div className="rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-800">
                {isFr
                  ? "Le paiement PayPal direct n'est pas encore activé. Contactez l'administrateur de la plateforme."
                  : "Direct PayPal checkout is not enabled. Contact the platform admin to activate it."}
              </div>
            ) : !hasPaypalClientId ? (
              /* checkout_enabled = true but env var missing */
              <div className="rounded-xl bg-red-50 px-3 py-3 text-sm text-red-700">
                {isFr
                  ? "Clé PayPal manquante dans les variables d'environnement. Contactez l'administrateur."
                  : "PayPal Client ID missing in environment variables. Contact the platform admin."}
              </div>
            ) : (
              /* Fully configured — show real checkout */
              <>
                <div className="flex gap-2">
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400"
                  >
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    min="1"
                    step="0.01"
                    className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:bg-white"
                  />
                </div>

                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t("pay_note_label")}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:bg-white"
                />

                {paypalError && (
                  <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{paypalError}</p>
                )}

                <PayPalButton
                  key={`${currency}-${amount}`}
                  amountValue={amount || "0"}
                  currency={currency}
                  targetType="platform"
                  targetId={null}
                  giveType="donation"
                  note={note}
                  lang={lang}
                  onSuccess={(donationId, captureId) => {
                    setPaypalSuccess({ donationId, captureId });
                    setPaypalError("");
                  }}
                  onError={(msg) => setPaypalError(msg)}
                />

                {/* Secure badge */}
                <div className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0070ba" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                  </svg>
                  <span className="text-xs font-semibold text-blue-700">
                    {isFr ? "Paiement PayPal sécurisé" : "Secure PayPal Checkout"}
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* PayPal success state */}
        {paypalSuccess && (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/>
              </svg>
            </div>
            <p className="font-semibold text-green-800">
              {isFr ? "Merci pour votre don ! Paiement confirmé." : "Thank you! Your payment has been confirmed."}
            </p>
            <button
              onClick={() => { setPaypalSuccess(null); setAmount(""); setNote(""); }}
              className="text-sm text-green-700 underline"
            >
              {isFr ? "Faire un autre don" : "Donate again"}
            </button>
          </div>
        )}

        {/* ── Manual form — mobile money, bank, etc. PayPal is NEVER here ─── */}
        {manualMethods.length > 0 && !success && (
          <div className="rounded-2xl bg-white p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900">
              {isFr ? "Enregistrer mon don (manuel)" : "Record my donation (manual)"}
            </h3>

            <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
              {t("pay_pending_notice")}
            </div>

            {/* Method select — PayPal never appears here */}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                {t("pay_method_select")}
              </label>
              <select
                value={selectedMethod}
                onChange={(e) => setSelectedMethod(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400"
              >
                {manualMethods.map((m) => (
                  <option key={m.id} value={m.method}>
                    {m.label || methodName(m.method)}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount + currency */}
            <div className="flex gap-2">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400"
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:bg-white"
              />
            </div>

            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={t("pay_reference")}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:bg-white"
            />

            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("pay_note_label")}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:bg-white"
            />

            {formError && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</p>
            )}

            <button
              onClick={submit}
              disabled={submitting || !amount || parseFloat(amount) <= 0}
              className="w-full rounded-xl bg-amber-500 py-3 font-bold text-white hover:bg-amber-600 disabled:opacity-60"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {isFr ? "Enregistrement…" : "Recording…"}
                </span>
              ) : t("pay_sent_button")}
            </button>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" />
              </svg>
            </div>
            <p className="font-semibold text-green-800">{t("pay_record_success")}</p>
            <button onClick={() => setSuccess(false)} className="text-sm text-green-700 underline">
              {isFr ? "Faire un autre don" : "Make another donation"}
            </button>
          </div>
        )}

        {/* Legal note */}
        <p className="text-center text-xs text-gray-400">
          {isFr
            ? "TheBride est une plateforme indépendante. Les dons sont volontaires et non remboursables."
            : "TheBride is an independent platform. Donations are voluntary and non-refundable."}
          {" "}
          <button onClick={() => router.push("/legal/donation-policy")} className="text-amber-500 hover:underline">
            {isFr ? "Politique de dons" : "Donation Policy"}
          </button>
        </p>
      </div>
    </main>
  );
}
