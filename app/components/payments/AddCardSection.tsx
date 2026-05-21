"use client";

import { useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { supabase } from "../../../lib/supabase";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

const CARD_STYLE = {
  style: {
    base: {
      fontSize: "15px",
      color: "#111827",
      fontFamily: "'Inter', sans-serif",
      "::placeholder": { color: "#9ca3af" },
    },
    invalid: { color: "#dc2626" },
  },
};

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
  onSuccess: (card: SavedCard) => void;
  onCancel?: () => void;
  lang: string;
};

function InnerForm({ onSuccess, onCancel, lang }: Props) {
  const stripe   = useStripe();
  const elements = useElements();
  const isFr     = lang === "fr";

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading]           = useState(true);
  const [saving,  setSaving]            = useState(false);
  const [error,   setError]             = useState("");

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setError(isFr ? "Non connecté" : "Not logged in"); setLoading(false); return; }

      const res = await fetch("/api/stripe/create-setup-intent", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json() as { client_secret?: string; error?: string };
      if (!res.ok || !json.client_secret) {
        setError(json.error ?? "Failed to initialize");
        setLoading(false);
        return;
      }
      setClientSecret(json.client_secret);
      setLoading(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || !clientSecret) return;

    setSaving(true);
    setError("");

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) { setSaving(false); return; }

    const { error: stripeErr, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
      payment_method: { card: cardElement },
      return_url: window.location.href,
    });

    if (stripeErr) {
      // Show code + message so admins can debug (e.g. "do_not_honor", "card_declined")
      const codePart = stripeErr.code ? ` [${stripeErr.code}]` : "";
      const declinePart = stripeErr.decline_code ? ` (${stripeErr.decline_code})` : "";
      setError((stripeErr.message ?? "Card setup failed") + codePart + declinePart);
      setSaving(false);
      return;
    }

    const pmId = typeof setupIntent?.payment_method === "string"
      ? setupIntent.payment_method
      : setupIntent?.payment_method?.id;

    if (!pmId) { setError("No payment method returned"); setSaving(false); return; }

    // Save to our DB via API
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/stripe/save-payment-method", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        Authorization:   `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ payment_method_id: pmId }),
    });

    const json = await res.json() as { saved?: SavedCard; error?: string };
    setSaving(false);

    if (!res.ok || !json.saved) {
      setError(json.error ?? "Failed to save card");
      return;
    }

    onSuccess(json.saved);
  };

  if (loading) {
    return (
      <div className="flex h-24 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* "No charge" notice — must be above the card input */}
      <div className="flex items-start gap-2 rounded-xl bg-green-50 px-3 py-2.5 text-xs text-green-800">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <span>
          {isFr
            ? "Votre carte sera enregistrée en toute sécurité. Aucun paiement ne sera effectué maintenant."
            : "Your card will be saved securely. No payment will be made now."}
        </span>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3.5 shadow-sm">
        <CardElement options={CARD_STYLE} />
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 px-3 py-2.5">
          <p className="text-sm font-medium text-red-600">{error}</p>
        </div>
      )}

      {/* Secure badge */}
      <div className="flex items-center gap-1.5 text-xs text-gray-400">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
        </svg>
        {isFr
          ? "Sécurisé par Stripe. Aucun numéro de carte stocké chez TheBride."
          : "Secured by Stripe. Card numbers are never stored by TheBride."}
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={!stripe || saving}
          className="flex-1 rounded-xl bg-brand-600 py-3 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              {isFr ? "Enregistrement…" : "Saving…"}
            </span>
          ) : (isFr ? "Enregistrer la carte" : "Save card")}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            {isFr ? "Annuler" : "Cancel"}
          </button>
        )}
      </div>
    </form>
  );
}

export default function AddCardSection({ onSuccess, onCancel, lang }: Props) {
  if (!stripePromise) {
    return (
      <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
        {lang === "fr"
          ? "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY manquant dans les variables d'environnement."
          : "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY missing in environment variables."}
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <InnerForm onSuccess={onSuccess} onCancel={onCancel} lang={lang} />
    </Elements>
  );
}
