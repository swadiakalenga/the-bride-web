"use client";

import { useEffect, useRef, useState } from "react";
import { loadScript } from "@paypal/paypal-js";
import type { PayPalButtonsComponentOptions } from "@paypal/paypal-js";
import { supabase } from "../../../lib/supabase";

// Currencies supported by PayPal Orders API v2
const PAYPAL_CURRENCIES = new Set([
  "AUD","BRL","CAD","CNY","CZK","DKK","EUR","HKD","HUF","ILS",
  "JPY","MYR","MXN","TWD","NZD","NOK","PHP","PLN","GBP","RUB",
  "SGD","SEK","CHF","THB","USD",
]);

export interface PayPalButtonProps {
  amountValue: string;            // decimal string e.g. "25.00"
  currency: string;               // ISO 4217
  targetType: "platform" | "church";
  targetId: string | null;
  giveType?: string;
  note?: string;
  lang?: string;
  onSuccess: (donationId: string, captureId: string) => void;
  onError: (msg: string) => void;
}

export default function PayPalButton({
  amountValue,
  currency,
  targetType,
  targetId,
  giveType,
  note,
  lang = "en",
  onSuccess,
  onError,
}: PayPalButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading]   = useState(false);
  const [sdkError, setSdkError] = useState(false);
  const isFr = lang === "fr";

  const upperCurrency = currency.toUpperCase();
  const supported     = PAYPAL_CURRENCIES.has(upperCurrency);
  const parsedAmount  = parseFloat(amountValue);
  const amountValid   = !isNaN(parsedAmount) && parsedAmount >= 1;

  // Keep a ref to latest prop values so the PayPal callbacks always capture them
  const latest = useRef({ amountValue, upperCurrency, targetType, targetId, giveType, note });
  useEffect(() => {
    latest.current = { amountValue, upperCurrency, targetType, targetId, giveType: giveType ?? "donation", note: note ?? "" };
  });

  useEffect(() => {
    if (!supported || !amountValid) return;

    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    if (!clientId) {
      setSdkError(true);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const paypal = await loadScript({
          clientId,
          currency: upperCurrency,
          intent:   "capture",
          components: "buttons",
        });

        if (cancelled || !paypal?.Buttons || !containerRef.current) return;

        // Clear previous render before re-rendering
        containerRef.current.innerHTML = "";

        const buttonConfig: PayPalButtonsComponentOptions = {
          style: {
            color:    "gold",
            shape:    "pill",
            height:   44,
            label:    "donate",
            tagline:  false,
          },

          createOrder: async () => {
            setLoading(true);
            const { v } = { v: latest.current };
            const { data: { session } } = await supabase.auth.getSession();

            const res = await fetch("/api/paypal/create-order", {
              method: "POST",
              headers: {
                "Content-Type":  "application/json",
                "Authorization": `Bearer ${session?.access_token ?? ""}`,
              },
              body: JSON.stringify({
                amount:     v.amountValue,
                currency:   v.upperCurrency,
                targetType: v.targetType,
                targetId:   v.targetId,
                giveType:   v.giveType,
                note:       v.note,
              }),
            });

            const json = await res.json() as { orderID?: string; error?: string };
            if (!res.ok) {
              onError(json.error ?? (isFr ? "Impossible de créer la commande" : "Could not create order"));
              setLoading(false);
              throw new Error(json.error ?? "create-order failed");
            }
            return json.orderID!;
          },

          onApprove: async (data) => {
            const { data: { session } } = await supabase.auth.getSession();

            const res = await fetch("/api/paypal/capture-order", {
              method: "POST",
              headers: {
                "Content-Type":  "application/json",
                "Authorization": `Bearer ${session?.access_token ?? ""}`,
              },
              body: JSON.stringify({ orderID: data.orderID }),
            });

            const json = await res.json() as {
              donationId?: string;
              captureId?:  string;
              error?:      string;
            };
            setLoading(false);

            if (!res.ok) {
              onError(json.error ?? (isFr ? "Paiement non confirmé" : "Payment not confirmed"));
              return;
            }

            onSuccess(json.donationId!, json.captureId ?? "");
          },

          onError: () => {
            onError(isFr
              ? "Une erreur PayPal s'est produite. Veuillez réessayer."
              : "A PayPal error occurred. Please try again.");
            setLoading(false);
          },

          onCancel: () => {
            setLoading(false);
          },
        };

        const buttons = paypal.Buttons(buttonConfig);
        if (buttons.isEligible()) {
          await buttons.render(containerRef.current!);
        } else {
          onError(isFr ? "PayPal non disponible dans votre région." : "PayPal is not available in your region.");
        }
      } catch {
        if (!cancelled) {
          setSdkError(true);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [upperCurrency, amountValid, supported]); // re-initialize on currency/validity change

  if (!supported) {
    return (
      <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-center text-xs text-amber-700">
        {isFr
          ? "PayPal est disponible en USD, EUR, GBP et autres devises majeures. Utilisez le formulaire manuel pour d'autres devises."
          : "PayPal checkout is available for USD, EUR, GBP and other major currencies. Use the manual form for other currencies."}
      </div>
    );
  }

  if (sdkError) {
    return (
      <div className="rounded-xl bg-red-50 px-3 py-2.5 text-center text-xs text-red-600">
        {isFr
          ? "Impossible de charger PayPal. Vérifiez votre connexion."
          : "Could not load PayPal. Check your internet connection."}
      </div>
    );
  }

  if (!amountValid) {
    return (
      <div className="flex items-center justify-center rounded-xl bg-gray-100 px-3 py-3">
        <span className="text-sm text-gray-400">
          {isFr ? "Entrez un montant pour activer PayPal (min. 1,00)" : "Enter an amount to enable PayPal (min. 1.00)"}
        </span>
      </div>
    );
  }

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/75 backdrop-blur-sm">
          <div className="h-5 w-5 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
        </div>
      )}
      <div ref={containerRef} className="min-h-[44px]" />
    </div>
  );
}
