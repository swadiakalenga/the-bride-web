import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createPayPalOrder } from "../../../../lib/paypal";

// Currencies PayPal Orders API v2 accepts
const PAYPAL_CURRENCIES = new Set([
  "AUD","BRL","CAD","CNY","CZK","DKK","EUR","HKD","HUF","ILS",
  "JPY","MYR","MXN","TWD","NZD","NOK","PHP","PLN","GBP","RUB",
  "SGD","SEK","CHF","THB","USD",
]);

const MIN_AMOUNT  = 1.00;
const MAX_AMOUNT  = 10_000.00;

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(req: NextRequest) {
  // ── 1. Verify caller is authenticated ────────────────────────────────────
  const jwt = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = adminClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Parse and validate body ───────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { amount, currency, targetType, targetId, giveType, note } = body;

  const parsedAmount = parseFloat(String(amount ?? ""));
  if (isNaN(parsedAmount) || parsedAmount < MIN_AMOUNT || parsedAmount > MAX_AMOUNT) {
    return NextResponse.json(
      { error: `Amount must be between ${MIN_AMOUNT.toFixed(2)} and ${MAX_AMOUNT.toFixed(2)}` },
      { status: 400 },
    );
  }

  const upperCurrency = String(currency ?? "").toUpperCase();
  if (!PAYPAL_CURRENCIES.has(upperCurrency)) {
    return NextResponse.json(
      { error: `Currency "${currency}" is not supported by PayPal. Use USD, EUR, GBP or another major currency.` },
      { status: 400 },
    );
  }

  if (!["platform", "church"].includes(String(targetType ?? ""))) {
    return NextResponse.json({ error: "Invalid target_type" }, { status: 400 });
  }

  const safeTargetId = targetId ? String(targetId) : null;

  // Validate church exists when targetType = 'church'
  if (targetType === "church" && safeTargetId) {
    const { data: church } = await supabase
      .from("churches")
      .select("id")
      .eq("id", safeTargetId)
      .maybeSingle();
    if (!church) {
      return NextResponse.json({ error: "Church not found" }, { status: 400 });
    }
  }

  // ── 3. Insert pending donation row ───────────────────────────────────────
  const amountValue = parsedAmount.toFixed(2);
  const { data: donation, error: insertErr } = await supabase
    .from("donations")
    .insert([
      {
        donor_id:    user.id,
        target_type: String(targetType),
        target_id:   safeTargetId,
        give_type:   giveType ? String(giveType) : "donation",
        amount:      parsedAmount,
        currency:    upperCurrency,
        method:      "paypal",
        provider:    "paypal",
        status:      "pending",
        note:        note ? String(note).slice(0, 500) : null,
      },
    ])
    .select("id")
    .single();

  if (insertErr || !donation) {
    return NextResponse.json(
      { error: insertErr?.message ?? "Failed to create donation record" },
      { status: 500 },
    );
  }

  // ── 4. Create PayPal order ───────────────────────────────────────────────
  try {
    const order = await createPayPalOrder({
      amountValue,
      currency:    upperCurrency,
      donationId:  donation.id,
      donorId:     user.id,
      targetType:  String(targetType),
      targetId:    safeTargetId,
    });

    // Attach the PayPal order ID to the donation row
    await supabase
      .from("donations")
      .update({
        paypal_order_id: order.id,
        provider_status: order.status,
      })
      .eq("id", donation.id);

    return NextResponse.json({ orderID: order.id, donationId: donation.id });
  } catch (e) {
    // Clean up orphaned pending row if PayPal rejected us
    await supabase.from("donations").delete().eq("id", donation.id);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "PayPal order creation failed" },
      { status: 502 },
    );
  }
}
