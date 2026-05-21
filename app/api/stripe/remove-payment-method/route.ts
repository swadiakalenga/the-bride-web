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
  if (!payment_method_id) return NextResponse.json({ error: "payment_method_id required" }, { status: 400 });

  // Verify ownership before touching Stripe
  const { data: existing } = await db
    .from("user_payment_methods")
    .select("id")
    .eq("user_id", user.id)
    .eq("stripe_payment_method_id", payment_method_id)
    .single();

  if (!existing) return NextResponse.json({ error: "Payment method not found" }, { status: 404 });

  // Detach from Stripe
  const stripe = getStripeServer();
  try {
    await stripe.paymentMethods.detach(payment_method_id);
  } catch {
    // If already detached in Stripe, still delete from our DB
  }

  // Remove from DB
  await db
    .from("user_payment_methods")
    .delete()
    .eq("user_id", user.id)
    .eq("stripe_payment_method_id", payment_method_id);

  return NextResponse.json({ removed: true });
}
