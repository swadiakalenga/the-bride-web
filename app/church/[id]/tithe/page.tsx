"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { supabase } from "../../../../lib/supabase";
import { useLanguage } from "../../../../lib/useLanguage";

const PayPalButton = dynamic(() => import("../../../components/payments/PayPalButton"), { ssr: false });

type PaymentSetting = {
  id: string;
  method: string;
  label: string | null;
  config: Record<string, unknown>;
  instructions: string | null;
};

/** True for both string "true" and boolean true — JSONB can return either */
function isTruthy(val: unknown): boolean {
  return val === "true" || val === true;
}

type Donation = {
  id: string;
  amount: number;
  currency: string;
  method: string;
  give_type: string | null;
  status: string;
  reference: string | null;
  created_at: string;
};

type Church = {
  id: string;
  name: string;
  verification_status: string | null;
};

const CURRENCIES = ["USD", "EUR", "GBP", "NGN", "KES", "ZAR", "GHS", "XAF", "XOF"];

const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-yellow-100 text-yellow-700",
  confirmed: "bg-green-100 text-green-700",
  rejected:  "bg-red-100 text-red-700",
};

export default function TithePage() {
  const params   = useParams();
  const router   = useRouter();
  const churchId = params.id as string;
  const { t, lang } = useLanguage();
  const isFr = lang === "fr";

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isChurchAdmin, setIsChurchAdmin] = useState(false);
  const [isMember, setIsMember]           = useState(false);
  const [church, setChurch]               = useState<Church | null>(null);
  const [methods, setMethods]             = useState<PaymentSetting[]>([]);
  const [myDonations, setMyDonations]     = useState<Donation[]>([]);
  const [loading, setLoading]             = useState(true);
  const [uiMessage, setUiMessage]         = useState("");

  const [giveType, setGiveType]       = useState<"tithe" | "offering" | "donation">("tithe");
  const [selectedMethod, setSelectedMethod] = useState<string>("");
  const [amount, setAmount]           = useState("");
  const [currency, setCurrency]       = useState("USD");
  const [reference, setReference]     = useState("");
  const [note, setNote]               = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [giveSuccess, setGiveSuccess] = useState(false);
  const [paypalSuccess, setPaypalSuccess] = useState<{ donationId: string; captureId: string } | null>(null);
  const [paypalError, setPaypalError]     = useState("");

  // Derived: is checkout-enabled PayPal configured? Safe against JSONB boolean vs string.
  const paypalMethod = methods.find((m) => m.method === "paypal");
  const paypalCheckoutEnabled =
    isTruthy(paypalMethod?.config?.checkout_enabled) &&
    !!process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  const load = useCallback(async () => {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    const me = authData.user?.id;
    if (!me) { router.push("/login"); return; }
    setCurrentUserId(me);

    const [churchRes, profileRes, memberRes, methodsRes, donRes] = await Promise.all([
      supabase.from("churches").select("id, name, verification_status").eq("id", churchId).maybeSingle(),
      supabase.from("profiles").select("role, church_id").eq("id", me).maybeSingle(),
      supabase.from("church_memberships").select("status").eq("church_id", churchId).eq("user_id", me).maybeSingle(),
      supabase.from("payment_settings").select("id, method, label, config, instructions").eq("owner_type", "church").eq("owner_id", churchId).eq("enabled", true),
      supabase.from("donations").select("id, amount, currency, method, give_type, status, reference, created_at").eq("target_type", "church").eq("target_id", churchId).eq("donor_id", me).order("created_at", { ascending: false }),
    ]);

    setChurch(churchRes.data ?? null);

    const admin = profileRes.data?.role === "church_admin" && profileRes.data?.church_id === churchId;
    setIsChurchAdmin(admin);
    setIsMember(memberRes.data?.status === "member" || admin);

    const loaded = (methodsRes.data as PaymentSetting[]) ?? [];
    setMethods(loaded);
    if (loaded.length > 0 && !selectedMethod) setSelectedMethod(loaded[0].method);

    setMyDonations((donRes.data as Donation[]) ?? []);
    setLoading(false);
  }, [churchId, router, selectedMethod]);

  useEffect(() => { load(); }, [churchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitGiving = async () => {
    if (!currentUserId || !selectedMethod || !amount || parseFloat(amount) <= 0) return;
    // PayPal checkout-enabled: real payment only — never insert a pending row manually
    if (selectedMethod === "paypal" && paypalCheckoutEnabled) return;
    setSubmitting(true);
    setUiMessage("");

    const { error } = await supabase.from("donations").insert([{
      donor_id:    currentUserId,
      target_type: "church",
      target_id:   churchId,
      give_type:   giveType,
      amount:      parseFloat(amount),
      currency,
      method:      selectedMethod,
      status:      "pending",
      reference:   reference || null,
      note:        note || null,
    }]);

    setSubmitting(false);
    if (error) { setUiMessage(error.message); return; }
    setAmount(""); setReference(""); setNote("");
    setGiveSuccess(true);
    await load();
    setTimeout(() => setGiveSuccess(false), 4000);
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
    const m = setting.method;
    return (
      <div className="space-y-1.5 text-sm">
        {m === "paypal" && (
          <>
            {cfg.email && <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2"><span className="text-gray-500">Email</span><a href={`mailto:${cfg.email}`} className="font-medium text-amber-600 hover:underline">{cfg.email}</a></div>}
            {cfg.link  && <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2"><span className="text-gray-500">PayPal.me</span><a href={cfg.link} target="_blank" rel="noopener noreferrer" className="font-medium text-amber-600 hover:underline">{cfg.link}</a></div>}
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
            {cfg.account_name   && <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2"><span className="text-gray-500">{isFr ? "Titulaire" : "Holder"}</span><span className="font-medium text-gray-900">{cfg.account_name}</span></div>}
            {cfg.account_number && <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2"><span className="text-gray-500">{isFr ? "Numéro" : "Account"}</span><span className="font-mono font-medium text-gray-900">{cfg.account_number}</span></div>}
            {cfg.routing_iban   && <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2"><span className="text-gray-500">IBAN / Routing</span><span className="font-mono font-medium text-gray-900">{cfg.routing_iban}</span></div>}
            {cfg.swift          && <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2"><span className="text-gray-500">SWIFT / BIC</span><span className="font-mono font-medium text-gray-900">{cfg.swift}</span></div>}
          </>
        )}
        {m === "stripe" && (
          <div className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">{t("pay_admin_stripe_note")}</div>
        )}
        {setting.instructions && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{setting.instructions}</p>
        )}
      </div>
    );
  };

  const fmt = (amt: number, cur: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(amt);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  const isVerified = church?.verification_status === "approved";

  return (
    <main className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3 shadow-sm">
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
          aria-label={t("common_back")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div>
          <h1 className="font-bold text-gray-900">
            {isFr ? `Donner à ${church?.name ?? "l'église"}` : `Give to ${church?.name ?? "Church"}`}
          </h1>
          <p className="text-xs text-gray-500">
            {isFr ? "Dîmes, offrandes & dons" : "Tithes, offerings & donations"}
          </p>
        </div>

        {/* Admin link */}
        {isChurchAdmin && (
          <button
            onClick={() => router.push(`/church/${churchId}/payments`)}
            className="ml-auto flex items-center gap-1 rounded-xl bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {isFr ? "Config" : "Setup"}
          </button>
        )}
      </div>

      <div className="mx-auto max-w-lg px-4 pt-6 space-y-5">
        {uiMessage && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{uiMessage}</div>
        )}

        {/* Unverified notice */}
        {!isVerified && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="font-semibold text-amber-800">{t("pay_unverified_short")}</p>
            <p className="mt-1 text-sm text-amber-700">{t("pay_unverified")}</p>
          </div>
        )}

        {/* Payment methods display */}
        {isVerified && methods.length > 0 && (
          <div className="rounded-2xl bg-white p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-gray-900">
              {isFr ? "Détails de paiement" : "Payment Details"}
            </h2>
            {methods.map((setting) => (
              <div key={setting.id}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {setting.label || methodName(setting.method)}
                </p>
                {renderMethodDetails(setting)}
              </div>
            ))}
          </div>
        )}

        {/* No methods set up yet */}
        {isVerified && methods.length === 0 && !isChurchAdmin && (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-2xl">🏦</div>
            <p className="font-semibold text-gray-800">
              {isFr ? "Paiement non configuré" : "Payment not set up yet"}
            </p>
            <p className="mt-1 text-sm text-gray-400">
              {isFr ? "L'administrateur n'a pas encore configuré les détails de paiement." : "The church admin has not configured payment details yet."}
            </p>
          </div>
        )}

        {/* Give form — members only, verified church, at least one method */}
        {isVerified && (isMember || isChurchAdmin) && methods.length > 0 && (
          <div className="rounded-2xl bg-white p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-gray-900">
              {isFr ? "Enregistrer mon don" : "Record My Giving"}
            </h2>

            {!(selectedMethod === "paypal" && paypalCheckoutEnabled) && (
              <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
                {t("pay_pending_notice")}
              </div>
            )}

            {/* Give type selector */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                {t("pay_give_type")}
              </label>
              <div className="flex gap-2">
                {(["tithe", "offering", "donation"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setGiveType(type)}
                    className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
                      giveType === type ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {type === "tithe" ? t("pay_give_tithe") : type === "offering" ? t("pay_give_offering") : t("pay_give_donation")}
                  </button>
                ))}
              </div>
            </div>

            {/* Method selector */}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
                {t("pay_method_select")}
              </label>
              <select
                value={selectedMethod}
                onChange={(e) => setSelectedMethod(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400"
              >
                {methods.map((m) => (
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

            {!(selectedMethod === "paypal" && paypalCheckoutEnabled) && (
              <>
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
              </>
            )}

            {giveSuccess && (
              <div className="rounded-xl bg-green-50 px-3 py-2.5 text-sm font-medium text-green-700">
                {t("pay_record_success")}
              </div>
            )}

            {/* PayPal Checkout — only when PayPal method selected and checkout enabled */}
            {selectedMethod === "paypal" && paypalCheckoutEnabled && (
              <div className="space-y-3 border-t border-gray-100 pt-4">
                <div className="flex items-center gap-2">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0070ba" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                  </svg>
                  <p className="text-sm font-semibold text-gray-700">
                    {isFr ? "Payer maintenant avec PayPal" : "Pay now with PayPal"}
                  </p>
                  <div className="ml-auto flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0070ba" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                    </svg>
                    <span className="text-xs font-semibold text-blue-700">
                      {isFr ? "Sécurisé" : "Secure"}
                    </span>
                  </div>
                </div>

                {paypalSuccess ? (
                  <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700 text-center">
                    <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/>
                      </svg>
                    </div>
                    <p className="font-semibold">
                      {isFr ? "Paiement confirmé ! Merci pour votre don." : "Payment confirmed! Thank you for giving."}
                    </p>
                    <button
                      onClick={() => { setPaypalSuccess(null); setPaypalError(""); setAmount(""); }}
                      className="mt-2 text-xs text-green-700 underline"
                    >
                      {isFr ? "Faire un autre don" : "Give again"}
                    </button>
                  </div>
                ) : (
                  <>
                    {paypalError && (
                      <div className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{paypalError}</div>
                    )}
                    <PayPalButton
                      key={`${currency}-${amount}`}
                      amountValue={amount || "0"}
                      currency={currency}
                      targetType="church"
                      targetId={churchId}
                      giveType={giveType}
                      note={note}
                      lang={lang}
                      onSuccess={(donationId, captureId) => {
                        setPaypalSuccess({ donationId, captureId });
                        setPaypalError("");
                        load();
                      }}
                      onError={(msg) => setPaypalError(msg)}
                    />
                    <div className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0070ba" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                      </svg>
                      <span className="text-xs font-semibold text-blue-700">
                        {isFr ? "Paiement PayPal sécurisé — Beta" : "Secure PayPal Checkout — Beta"}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Manual record button (non-PayPal or when checkout not enabled) */}
            {!(selectedMethod === "paypal" && paypalCheckoutEnabled) && (
              <button
                onClick={submitGiving}
                disabled={submitting || !selectedMethod || !amount || parseFloat(amount) <= 0}
                className="w-full rounded-xl bg-amber-500 py-3 font-bold text-white hover:bg-amber-600 disabled:opacity-60"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    {isFr ? "Enregistrement…" : "Recording…"}
                  </span>
                ) : t("pay_sent_button")}
              </button>
            )}
          </div>
        )}

        {/* Non-member gate */}
        {isVerified && !isMember && !isChurchAdmin && methods.length > 0 && (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-gray-500">
              {isFr ? "Vous devez être membre pour enregistrer un don." : "You must be a church member to record giving."}
            </p>
            <button onClick={() => router.back()} className="mt-3 text-sm font-semibold text-amber-600">
              {isFr ? "Demander l'adhésion depuis le profil de l'église" : "Request membership from the church profile"}
            </button>
          </div>
        )}

        {/* Giving history */}
        {myDonations.length > 0 && (
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-bold text-gray-900">{t("pay_my_history")}</h2>
            <div className="space-y-2">
              {myDonations.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold capitalize text-amber-700">
                        {d.give_type ?? t("pay_give_donation")}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[d.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {d.status === "pending" ? t("pay_status_pending") : d.status === "confirmed" ? t("pay_status_confirmed") : t("pay_status_rejected")}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {new Date(d.created_at).toLocaleDateString()}
                      {d.reference ? ` · ${d.reference}` : ""}
                      {" · "}{methodName(d.method)}
                    </p>
                  </div>
                  <p className="font-bold text-gray-900">{fmt(d.amount, d.currency)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
