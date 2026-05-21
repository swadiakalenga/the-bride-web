import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────────
// PayPal Webhook Handler
//
// IMPORTANT — Webhook signature verification is marked TODO below.
// Before enabling in production:
//   1. In the PayPal dashboard → My Apps → your app → Webhooks → Add webhook
//      URL: https://thebride.app/api/paypal/webhook
//      Events: PAYMENT.CAPTURE.COMPLETED, PAYMENT.CAPTURE.DENIED,
//              PAYMENT.CAPTURE.REFUNDED
//   2. Copy the Webhook ID → add to Vercel env as PAYPAL_WEBHOOK_ID
//   3. Implement signature verification using PayPal's /v1/notifications/verify-webhook-signature
//      API call (see verifyWebhookSignature below — currently stubbed out).
//
// Without verified signatures, a malicious actor could POST a fake
// PAYMENT.CAPTURE.COMPLETED event to this endpoint and confirm donations
// that were never paid.  Do NOT remove the TODO before shipping.
// ─────────────────────────────────────────────────────────────────────────────

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// TODO: implement real signature verification before production
async function verifyWebhookSignature(_req: NextRequest, _body: string): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    // If no webhook ID configured, log and reject all webhook events
    console.warn("[paypal-webhook] PAYPAL_WEBHOOK_ID not set — rejecting event");
    return false;
  }

  // TODO: call PayPal /v1/notifications/verify-webhook-signature
  // Reference: https://developer.paypal.com/api/webhooks/v1/#verify-webhook-signature_post
  //
  // const token = await getAccessToken();
  // const res = await fetch(`${BASE}/v1/notifications/verify-webhook-signature`, {
  //   method: "POST",
  //   headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  //   body: JSON.stringify({
  //     auth_algo:         req.headers.get("paypal-auth-algo"),
  //     cert_url:          req.headers.get("paypal-cert-url"),
  //     transmission_id:   req.headers.get("paypal-transmission-id"),
  //     transmission_sig:  req.headers.get("paypal-transmission-sig"),
  //     transmission_time: req.headers.get("paypal-transmission-time"),
  //     webhook_id:        webhookId,
  //     webhook_event:     JSON.parse(body),
  //   }),
  // });
  // const { verification_status } = await res.json();
  // return verification_status === "SUCCESS";

  console.warn("[paypal-webhook] Signature verification not yet implemented — REJECTING event");
  return false;
}

type PayPalWebhookEvent = {
  id:          string;
  event_type:  string;
  resource:    {
    id:             string;   // capture ID
    status:         string;
    custom_id?:     string;   // our donation ID stored in custom_id
    amount?:        { currency_code: string; value: string };
    supplementary_data?: { related_ids?: { order_id?: string } };
  };
};

export async function POST(req: NextRequest) {
  const body = await req.text();

  const verified = await verifyWebhookSignature(req, body);
  if (!verified) {
    // Return 200 so PayPal stops retrying — we log the event but take no action
    console.error("[paypal-webhook] Unverified event received — ignoring");
    return NextResponse.json({ received: true, processed: false });
  }

  let event: PayPalWebhookEvent;
  try {
    event = JSON.parse(body) as PayPalWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = adminClient();

  switch (event.event_type) {
    case "PAYMENT.CAPTURE.COMPLETED": {
      const capture = event.resource;
      const orderId = capture.supplementary_data?.related_ids?.order_id;

      if (orderId && capture.status === "COMPLETED") {
        // Idempotent: confirm_paypal_donation handles already-confirmed rows
        // Reconciliation: mark confirmed via a direct update when we have the order ID.
        // confirm_paypal_donation RPC requires donor_id which is unknown from webhooks,
        // so use a direct update here instead. This is safe because we've already
        // verified the webhook signature above.
        await supabase
          .from("donations")
          .update({
            status:            "confirmed",
            paypal_capture_id: capture.id,
            provider:          "paypal",
            provider_status:   capture.status,
            confirmed_at:      new Date().toISOString(),
          })
          .eq("paypal_order_id", orderId)
          .eq("status", "pending"); // only update if still pending (idempotent)
      }
      break;
    }

    case "PAYMENT.CAPTURE.DENIED": {
      const capture = event.resource;
      const orderId = capture.supplementary_data?.related_ids?.order_id;
      if (orderId) {
        await supabase
          .from("donations")
          .update({ status: "rejected", provider_status: "DENIED" })
          .eq("paypal_order_id", orderId)
          .eq("status", "pending");
      }
      break;
    }

    case "PAYMENT.CAPTURE.REFUNDED": {
      const capture = event.resource;
      const orderId = capture.supplementary_data?.related_ids?.order_id;
      if (orderId) {
        await supabase
          .from("donations")
          .update({ status: "rejected", provider_status: "REFUNDED" })
          .eq("paypal_order_id", orderId);
      }
      break;
    }

    default:
      // Unhandled event type — acknowledge so PayPal stops retrying
      break;
  }

  return NextResponse.json({ received: true, processed: true });
}
