"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { supabase } from "../../../lib/supabase";
import { useLanguage } from "../../../lib/useLanguage";

const AddCardSection = dynamic(() => import("../../components/payments/AddCardSection"), { ssr: false });

type SavedCard = {
  id: string;
  stripe_payment_method_id: string;
  card_brand: string | null;
  card_last4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  is_default: boolean;
  created_at?: string;
};

const BRAND_LABEL: Record<string, string> = {
  visa: "Visa", mastercard: "Mastercard", amex: "American Express",
  discover: "Discover", jcb: "JCB", unionpay: "UnionPay",
};

function CardIcon({ brand }: { brand: string | null }) {
  return (
    <div className="flex h-9 w-14 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 font-bold text-xs text-gray-600">
      {BRAND_LABEL[brand ?? ""] ?? "Card"}
    </div>
  );
}

export default function PaymentMethodsPage() {
  const { lang } = useLanguage();
  const isFr = lang === "fr";

  const [cards,       setCards]       = useState<SavedCard[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showAdd,     setShowAdd]     = useState(false);
  const [removing,    setRemoving]    = useState<string | null>(null);
  const [error,       setError]       = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("user_payment_methods")
      .select("id, stripe_payment_method_id, card_brand, card_last4, card_exp_month, card_exp_year, is_default, created_at")
      .order("created_at", { ascending: false });
    setCards((data as SavedCard[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const removeCard = async (pmId: string) => {
    setRemoving(pmId);
    setError("");
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/stripe/remove-payment-method", {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body:    JSON.stringify({ payment_method_id: pmId }),
    });
    const json = await res.json() as { error?: string };
    setRemoving(null);
    if (!res.ok) { setError(json.error ?? "Failed to remove"); return; }
    setCards((prev) => prev.filter((c) => c.stripe_payment_method_id !== pmId));
  };

  const handleAdded = (card: SavedCard) => {
    setCards((prev) => [card, ...prev]);
    setShowAdd(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {isFr ? "Moyens de paiement" : "Payment Methods"}
        </h1>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {isFr ? "Ajouter une carte" : "Add a card"}
          </button>
        )}
      </div>

      <p className="text-sm text-gray-500">
        {isFr
          ? "Vos cartes enregistrées sont utilisées pour les dons. TheBride ne stocke jamais les numéros de carte."
          : "Your saved cards are used for donations. TheBride never stores card numbers."}
      </p>

      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {/* Add card form */}
      {showAdd && (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="mb-4 font-semibold text-gray-900">
            {isFr ? "Nouvelle carte" : "New card"}
          </p>
          <AddCardSection
            onSuccess={handleAdded}
            onCancel={() => setShowAdd(false)}
            lang={lang}
          />
        </div>
      )}

      {/* Card list */}
      {loading ? (
        <div className="flex h-24 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : cards.length === 0 && !showAdd ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-2xl">
            💳
          </div>
          <p className="font-semibold text-gray-700">
            {isFr ? "Aucune carte enregistrée" : "No saved cards"}
          </p>
          <p className="mt-1 text-sm text-gray-400">
            {isFr
              ? "Ajoutez une carte pour faire des dons rapidement."
              : "Add a card to donate quickly without re-entering details."}
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="mt-4 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-700"
          >
            {isFr ? "Ajouter une carte" : "Add a card"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map((card) => (
            <div key={card.id} className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm">
              <CardIcon brand={card.card_brand} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 font-mono">
                  {BRAND_LABEL[card.card_brand ?? ""] ?? "Card"} ••••&nbsp;{card.card_last4}
                </p>
                {card.card_exp_month && card.card_exp_year && (
                  <p className="text-xs text-gray-400">
                    {isFr ? "Expire" : "Expires"}{" "}
                    {String(card.card_exp_month).padStart(2, "0")}/{card.card_exp_year}
                  </p>
                )}
                {card.is_default && (
                  <span className="mt-1 inline-block rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
                    {isFr ? "Carte principale" : "Default"}
                  </span>
                )}
              </div>
              <button
                onClick={() => removeCard(card.stripe_payment_method_id)}
                disabled={removing === card.stripe_payment_method_id}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50 transition"
                aria-label={isFr ? "Supprimer" : "Remove"}
              >
                {removing === card.stripe_payment_method_id ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Security note */}
      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <div className="flex items-start gap-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <div className="text-xs text-gray-500 space-y-1">
            <p className="font-semibold text-gray-700">
              {isFr ? "Sécurité des paiements" : "Payment security"}
            </p>
            <p>
              {isFr
                ? "TheBride utilise Stripe pour traiter les paiements. Aucun numéro de carte n'est stocké dans nos bases de données — seules les 4 derniers chiffres, la marque et la date d'expiration sont conservés."
                : "TheBride uses Stripe to process payments. No card numbers are stored in our database — only the last 4 digits, brand, and expiry date are kept."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
