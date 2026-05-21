import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStripeServer, toSmallestUnit, STRIPE_CURRENCIES } from "../../../../lib/stripe";

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const SUPPORTED = new Set(STRIPE_CURRENCIES.map((c) => c.toLowerCase()));

export async function POST(req: NextRequest) {
  const jwt = req.headers.get("Authorization")?.slice(7);
  if (!jwt) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = adminDb();
  const { data: { user }, error: authErr } = await db.auth.getUser(jwt);
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    payment_method_id: string;
    amount:      number;
    currency:    string;
    target_type: string;
    target_id:   string | null;
    give_type:   string;
    note?:       string;
  };

  const { payment_method_id, amount, currency, target_type, target_id, give_type, note } = body;

  if (!payment_method_id?.startsWith("pm_")) {
    return NextResponse.json({ error: "Invalid payment_method_id" }, { status: 400 });
  }
  if (!amount || amount < 0.5 || amount > 100_000) {
    return NextResponse.json({ error: "Amount must be between 0.50 and 100,000" }, { status: 400 });
  }
  if (!SUPPORTED.has(currency?.toLowerCase())) {
    return NextResponse.json({ error: `Unsupported currency: ${currency}` }, { status: 400 });
  }
  if (!["platform", "church"].includes(target_type)) {
    return NextResponse.json({ error: "Invalid target_type" }, { status: 400 });
  }

  const { data: profile } = await db
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  const customerId: string = profile?.stripe_customer_id as string;
  if (!customerId) {
    return NextResponse.json({ error: "No Stripe customer found. Add a card first." }, { status: 400 });
  }

  // Verify the PM belongs to this user
  const pmOwner = await db
    .from("user_payment_methods")
    .select("id")
    .eq("user_id", user.id)
    .eq("stripe_payment_method_id", payment_method_id)
    .single();

  if (!pmOwner.data) {
    return NextResponse.json({ error: "Payment method not found" }, { status: 403 });
  }

  const amountUnits = toSmallestUnit(amount, currency);

  // Insert pending donation first
  const { data: donation, error: donErr } = await db
    .from("donations")
    .insert({
      donor_id:          user.id,
      target_type,
      target_id:         target_id ?? null,
      give_type:         give_type || "donation",
      amount,
      currency:          currency.toUpperCase(),
      method:            "stripe",
      provider:          "stripe",
      status:            "pending",
      stripe_customer_id: customerId,
      note:              note || null,
    })
    .select("id")
    .single();

  if (donErr || !donation) {
    return NextResponse.json({ error: donErr?.message ?? "Failed to create donation" }, { status: 500 });
  }

  const stripe = getStripeServer();

  let pi: Awaited<ReturnType<typeof stripe.paymentIntents.create>>;
  try {
    pi = await stripe.paymentIntents.create({
      amount:         amountUnits,
      currency:       currency.toLowerCase(),
      customer:       customerId,
      payment_method: payment_method_id,
      confirm:        true,
      off_session:    false,
      return_url:     `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://thebride.app"}/settings/payment-methods`,
      metadata: {
        donation_id:  donation.id,
        target_type,
        target_id:    target_id ?? "",
        give_type:    give_type || "donation",
        user_id:      user.id,
      },
    });
  } catch (err: unknown) {
    // Payment failed at Stripe level
    await db.from("donations").update({ status: "rejected" }).eq("id", donation.id);
    const message = err instanceof Error ? err.message : "Payment failed";
    return NextResponse.json({ error: message }, { status: 402 });
  }

  // Update donation with the PaymentIntent ID
  await db.from("donations").update({ stripe_payment_intent_id: pi.id }).eq("id", donation.id);

  if (pi.status === "succeeded") {
    await db
      .from("donations")
      .update({
        status:       "confirmed",
        confirmed_at: new Date().toISOString(),
        provider_status: "succeeded",
      })
      .eq("id", donation.id);
    return NextResponse.json({ status: "succeeded", donationId: donation.id });
  }

  if (pi.status === "requires_action" || pi.status === "requires_confirmation") {
    return NextResponse.json({
      status:        "requires_action",
      client_secret: pi.client_secret,
      donationId:    donation.id,
    });
  }

  // Any other status is a failure
  await db.from("donations").update({ status: "rejected", provider_status: pi.status }).eq("id", donation.id);
  return NextResponse.json({ error: "Payment was not completed" }, { status: 402 });
}
