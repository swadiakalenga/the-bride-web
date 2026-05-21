import Stripe from "stripe";

const API_VERSION = "2026-04-22.dahlia" as const;

/** Zero-decimal currencies — amount is in whole units, NOT cents */
export const ZERO_DECIMAL = new Set([
  "bif","clp","gnf","jpy","kmf","mga","pyg","rwf","ugx","vnd","xaf","xof","xpf",
]);

export const STRIPE_CURRENCIES = [
  "USD","EUR","GBP","NGN","KES","ZAR","GHS","XAF","XOF",
];

export function toSmallestUnit(amount: number, currency: string): number {
  return ZERO_DECIMAL.has(currency.toLowerCase())
    ? Math.round(amount)
    : Math.round(amount * 100);
}

let _client: Stripe | null = null;

export function getStripeServer(): Stripe {
  if (!_client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
    _client = new Stripe(key, { apiVersion: API_VERSION });
  }
  return _client;
}
