// Server-side PayPal Orders API v2 helper.
// Never import this file from a "use client" component — it reads secret env vars.

const BASE =
  process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret   = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !secret) {
    throw new Error("PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is not configured");
  }

  const credentials = Buffer.from(`${clientId}:${secret}`).toString("base64");

  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal auth failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export type CreateOrderParams = {
  amountValue: string;    // decimal string, e.g. "25.00"
  currency: string;       // ISO 4217, e.g. "USD"
  donationId: string;     // our DB donation ID (stored as custom_id)
  donorId: string;
  targetType: string;
  targetId: string | null;
};

export type PayPalOrderResponse = {
  id: string;
  status: string;
  links: { href: string; rel: string; method: string }[];
};

export async function createPayPalOrder(params: CreateOrderParams): Promise<PayPalOrderResponse> {
  const token = await getAccessToken();

  const res = await fetch(`${BASE}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": params.donationId, // idempotency key
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: params.currency.toUpperCase(),
            value: params.amountValue,
          },
          custom_id: params.donationId,
          description: `TheBride donation – ${params.targetType}`,
        },
      ],
      application_context: {
        brand_name: "TheBride",
        landing_page: "NO_PREFERENCE",
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
      },
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? `PayPal order creation failed (${res.status})`);
  }

  return res.json() as Promise<PayPalOrderResponse>;
}

export type CaptureResult = {
  orderId: string;
  captureId: string;
  status: string;
  currency: string;
  amountValue: string;
};

export async function capturePayPalOrder(orderId: string): Promise<CaptureResult> {
  const token = await getAccessToken();

  const res = await fetch(`${BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? `PayPal capture failed (${res.status})`);
  }

  const data = await res.json() as {
    id: string;
    status: string;
    purchase_units: {
      payments: {
        captures: {
          id: string;
          status: string;
          amount: { currency_code: string; value: string };
        }[];
      };
    }[];
  };

  const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
  if (!capture) throw new Error("PayPal capture response malformed");

  return {
    orderId:      data.id,
    captureId:    capture.id,
    status:       capture.status,
    currency:     capture.amount.currency_code,
    amountValue:  capture.amount.value,
  };
}
