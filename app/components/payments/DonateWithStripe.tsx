"use client";

import { useState, useEffect, useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import dynamic from "next/dynamic";
import { supabase } from "../../../lib/supabase";
import { STRIPE_CURRENCIES } from "../../../lib/stripe";
import { trackEvent } from "../../../lib/analytics/trackEvent";

const AddCardSection = dynamic(() => import("./AddCardSection"), { ssr: false });

type SavedCard = {
  id: string;
  stripe_payment_method_id: string;
  card_brand: string | null;
  card_last4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  is_default: boolean;
};

type Props = {
  targetType:    "platform" | "church";
  targetId:      string | null;
  showGiveType?: boolean;
  lang:          string;
  onSuccess?:    (donationId: string) => void;
};

const BRAND_LABEL: Record<string, string> = {
  visa:       "Visa",
  mastercard: "Mastercard",
  amex:       "Amex",
  discover:   "Discover",
  jcb:        "JCB",
  unionpay:   "UnionPay",
};

function CardChip({ card }: { card: SavedCard }) {
  const brand = BRAND_LABEL[card.card_brand ?? ""] ?? (card.card_brand ?? "Card");
  return (
    <span className="inline-flex items-center gap-2 font-mono text-sm">
      <span className="font-semibold capitalize text-gray-700">{brand}</span>
      <span className="text-gray-500">••••&nbsp;{card.card_last4}</span>
      {card.card_exp_month && card.card_exp_year && (
        <span className="text-xs text-gray-400">
          {String(card.card_exp_month).padStart(2, "0")}/{String(card.card_exp_year).slice(-2)}
        </span>
      )}
    </span>
  );
}

export default function DonateWithStripe({
  targetType,
  targetId,
  showGiveType = false,
  lang,
  onSuccess,
}: Props) {
  const isFr = lang === "fr";

  const [cards,          setCards]          = useState<SavedCard[]>([]);
  const [loadingCards,   setLoadingCards]   = useState(true);
  const [selectedCardId, setSelectedCardId] = useState<string>("");
  const [showAddCard,    setShowAddCard]    = useState(false);

  const [giveType, setGiveType]   = useState<"tithe" | "offering" | "donation">("donation");
  const [amount,   setAmount]     = useState("");
  const [currency, setCurrency]   = useState("USD");
  const [note,     setNote]       = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [donationId, setDonationId] = useState<string | null>(null);
  const [error,      setError]      = useState("");

  const loadCards = useCallback(async () => {
    setLoadingCards(true);
    const { data } = await supabase
      .from("user_payment_methods")
      .select("id, stripe_payment_method_id, card_brand, card_last4, card_exp_month, card_exp_year, is_default")
      .order("created_at", { ascending: false });
    const list = (data as SavedCard[]) ?? [];
    setCards(list);
    if (list.length > 0 && !selectedCardId) {
      const def = list.find((c) => c.is_default) ?? list[0];
      setSelectedCardId(def.stripe_payment_method_id);
    }
    if (list.length === 0) setShowAddCard(true);
    setLoadingCards(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadCards(); }, [loadCards]);

  const handleCardAdded = (card: SavedCard) => {
    setCards((prev) => [card, ...prev]);
    setSelectedCardId(card.stripe_payment_method_id);
    setShowAddCard(false);
  };

  const donate = async () => {
    if (!selectedCardId) { setError(isFr ? "Sélectionnez une carte" : "Select a card"); return; }
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed < 0.5) {
      setError(isFr ? "Montant minimum : 0.50" : "Minimum amount: 0.50");
      return;
    }
    setSubmitting(true);
    setError("");

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) { setError(isFr ? "Non connecté" : "Not logged in"); setSubmitting(false); return; }

    const res = await fetch("/api/stripe/create-payment-intent", {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        payment_method_id: selectedCardId,
        amount:            parsed,
        currency,
        target_type:       targetType,
        target_id:         targetId,
        give_type:         showGiveType ? giveType : "donation",
        note:              note || undefined,
      }),
    });

    const data = await res.json() as {
      status?:        string;
      donationId?:    string;
      client_secret?: string;
      error?:         string;
    };

    if (!res.ok || data.error) {
      setError(data.error ?? "Payment failed");
      setSubmitting(false);
      return;
    }

    if (data.status === "succeeded") {
      trackEvent("donation_completed", { entity_type: "donation", entity_id: data.donationId });
      setDonationId(data.donationId ?? "");
      onSuccess?.(data.donationId ?? "");
      setSubmitting(false);
      return;
    }

    // 3DS required — use Stripe.js to complete authentication
    if (data.status === "requires_action" && data.client_secret) {
      const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      if (!key) { setError("Stripe not configured"); setSubmitting(false); return; }

      const stripeJs = await loadStripe(key);
      if (!stripeJs) { setError("Failed to load Stripe"); setSubmitting(false); return; }

      const { error: confirmErr, paymentIntent } = await stripeJs.confirmCardPayment(data.client_secret!);
      if (confirmErr) {
        setError(confirmErr.message ?? "Authentication failed");
      } else if (paymentIntent?.status === "succeeded") {
        trackEvent("donation_completed", { entity_type: "donation", entity_id: data.donationId });
        setDonationId(data.donationId ?? "");
        onSuccess?.(data.donationId ?? "");
      } else {
        setError(isFr ? "Paiement non abouti" : "Payment did not complete");
      }
      setSubmitting(false);
      return;
    }

    setError(data.error ?? "Unexpected error");
    setSubmitting(false);
  };

  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    return (
      <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
        {isFr
          ? "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY manquant. Configurez Stripe dans Vercel."
          : "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY missing. Configure Stripe in Vercel."}
      </div>
    );
  }

  if (donationId) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/>
          </svg>
        </div>
        <p className="font-bold text-green-800">
          {isFr ? "Merci ! Votre don a été confirmé." : "Thank you! Your donation is confirmed."}
        </p>
        <button
          onClick={() => { setDonationId(null); setAmount(""); setNote(""); }}
          className="text-sm text-green-700 underline"
        >
          {isFr ? "Faire un autre don" : "Donate again"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Give type — tithe page only */}
      {showGiveType && (
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
            {isFr ? "Type de don" : "Type"}
          </label>
          <div className="flex gap-2">
            {(["tithe", "offering", "donation"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setGiveType(type)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
                  giveType === type ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {type === "tithe"
                  ? (isFr ? "Dîme"     : "Tithe")
                  : type === "offering"
                    ? (isFr ? "Offrande" : "Offering")
                    : (isFr ? "Don"      : "Gift")}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Amount + currency */}
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
          {isFr ? "Montant" : "Amount"}
        </label>
        <div className="flex gap-2">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
          >
            {STRIPE_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min="0.5"
            step="0.01"
            className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:bg-white"
          />
        </div>
      </div>

      {/* Note */}
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={isFr ? "Note (optionnel)" : "Note (optional)"}
        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:bg-white"
      />

      {/* Card selector */}
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
          {isFr ? "Carte de paiement" : "Payment card"}
        </label>

        {loadingCards ? (
          <div className="flex h-12 items-center justify-center">
            <div className="h-4 w-4 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-2">
            {cards.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => { setSelectedCardId(card.stripe_payment_method_id); setShowAddCard(false); }}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                  selectedCardId === card.stripe_payment_method_id
                    ? "border-brand-500 bg-brand-50"
                    : "border-gray-200 bg-white hover:bg-gray-50"
                }`}
              >
                <div className={`h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center ${
                  selectedCardId === card.stripe_payment_method_id
                    ? "border-brand-500 bg-brand-500"
                    : "border-gray-300"
                }`}>
                  {selectedCardId === card.stripe_payment_method_id && (
                    <div className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </div>
                <CardChip card={card} />
              </button>
            ))}

            {/* Add new card option */}
            <button
              type="button"
              onClick={() => { setSelectedCardId(""); setShowAddCard(true); }}
              className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                showAddCard ? "border-brand-500 bg-brand-50" : "border-dashed border-gray-200 hover:bg-gray-50"
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
              <span className="text-sm font-semibold text-brand-600">
                {isFr ? "Ajouter une carte" : "Add a card"}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Add card form — shown inline */}
      {showAddCard && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="mb-3 text-sm font-semibold text-gray-700">
            {isFr ? "Nouvelle carte" : "New card"}
          </p>
          <AddCardSection
            onSuccess={handleCardAdded}
            onCancel={cards.length > 0 ? () => setShowAddCard(false) : undefined}
            lang={lang}
          />
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-600">{error}</p>
      )}

      {/* Donate button */}
      {!showAddCard && (
        <button
          onClick={donate}
          disabled={submitting || !selectedCardId || !amount || parseFloat(amount) < 0.5}
          className="w-full rounded-xl bg-brand-600 py-3.5 font-bold text-white hover:bg-brand-700 disabled:opacity-60 transition"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              {isFr ? "Traitement…" : "Processing…"}
            </span>
          ) : (
            isFr ? "Faire un don par carte" : "Donate with card"
          )}
        </button>
      )}

      {/* Secure footer */}
      {!showAddCard && (
        <div className="flex items-center justify-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
          <span className="text-xs text-gray-400">
            {isFr ? "Paiement sécurisé via Stripe" : "Secure payment via Stripe"}
          </span>
        </div>
      )}
    </div>
  );
}
