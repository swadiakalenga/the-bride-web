import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyPayPalWebhook } from "../../../../lib/paypal";

// ─────────────────────────────────────────────────────────────────────────────
// PayPal Webhook Handler
//
// Signature verification is implemented via verifyPayPalWebhook() from lib/paypal.
//
// Required Vercel env vars:
//   PAYPAL_WEBHOOK_ID   — from PayPal dashboard → Your App → Webhooks
//   PAYPAL_CLIENT_ID    — PayPal app client ID
//   PAYPAL_CLIENT_SECRET — PayPal app secret
//   PAYPAL_MODE         — "live" or "sandbox" (defaults to sandbox)
//
// To register the webhook in PayPal dashboard:
//   1. Apps & Credentials → your app → Webhooks → Add webhook
//   2. URL: https://thebride.app/api/paypal/webhook
//   3. Events: PAYMENT.CAPTURE.COMPLETED, PAYMENT.CAPTURE.DENIED,
//              PAYMENT.CAPTURE.REFUNDED
//   4. Copy the Webhook ID → add to Vercel as PAYPAL_WEBHOOK_ID
// ─────────────────────────────────────────────────────────────────────────────

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
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

  const verified = await verifyPayPalWebhook(req, body);
  if (!verified) {
    // Return 200 so PayPal stops retrying — we log the event but take no action
    console.error("[paypal-webhook] Signature verification failed — ignoring event");
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
