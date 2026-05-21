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

  const stripe = getStripeServer();

  const { data: profile } = await db
    .from("profiles")
    .select("stripe_customer_id, full_name")
    .eq("id", user.id)
    .single();

  let customerId: string = profile?.stripe_customer_id ?? "";

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name:  (profile?.full_name as string | null) ?? undefined,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await db.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
  }

  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    usage: "on_session",
    payment_method_types: ["card"],
  });

  return NextResponse.json({
    client_secret: setupIntent.client_secret,
    customer_id:   customerId,
  });
}
