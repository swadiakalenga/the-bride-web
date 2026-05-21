import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStripeServer } from "../../../../lib/stripe";
import Stripe from "stripe";

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig     = req.headers.get("stripe-signature") ?? "";
  const secret  = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const stripe = getStripeServer();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    console.error("[stripe-webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const db = adminDb();

  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      await db
        .from("donations")
        .update({
          status:            "confirmed",
          provider_status:   "succeeded",
          confirmed_at:      new Date().toISOString(),
        })
        .eq("stripe_payment_intent_id", pi.id)
        .eq("status", "pending");
      break;
    }

    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      await db
        .from("donations")
        .update({
          status:          "rejected",
          provider_status: pi.last_payment_error?.code ?? "payment_failed",
        })
        .eq("stripe_payment_intent_id", pi.id)
        .eq("status", "pending");
      break;
    }

    case "setup_intent.succeeded":
      // Card saved — no DB action needed (handled synchronously in save-payment-method route)
      break;

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
