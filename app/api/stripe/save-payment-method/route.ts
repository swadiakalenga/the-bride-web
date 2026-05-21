import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStripeServer } from "../../../../lib/stripe";

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(req: NextRequest) {
  const jwt = req.headers.get("Authorization")?.slice(7);
  if (!jwt) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = adminDb();
  const { data: { user }, error: authErr } = await db.auth.getUser(jwt);
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { payment_method_id } = (await req.json()) as { payment_method_id: string };
  if (!payment_method_id?.startsWith("pm_")) {
    return NextResponse.json({ error: "Invalid payment_method_id" }, { status: 400 });
  }

  const { data: profile } = await db
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  const customerId: string = profile?.stripe_customer_id as string;
  if (!customerId) return NextResponse.json({ error: "No Stripe customer — call create-setup-intent first" }, { status: 400 });

  const stripe = getStripeServer();
  const pm = await stripe.paymentMethods.retrieve(payment_method_id);

  // Attach to customer if not already attached
  if (pm.customer !== customerId) {
    await stripe.paymentMethods.attach(payment_method_id, { customer: customerId });
  }

  const card = pm.card;

  const { data: saved, error: dbErr } = await db
    .from("user_payment_methods")
    .upsert(
      {
        user_id:                  user.id,
        stripe_customer_id:       customerId,
        stripe_payment_method_id: payment_method_id,
        card_brand:               card?.brand ?? null,
        card_last4:               card?.last4 ?? null,
        card_exp_month:           card?.exp_month ?? null,
        card_exp_year:            card?.exp_year ?? null,
      },
      { onConflict: "stripe_payment_method_id" },
    )
    .select("id, stripe_payment_method_id, card_brand, card_last4, card_exp_month, card_exp_year, is_default")
    .single();

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ saved });
}
