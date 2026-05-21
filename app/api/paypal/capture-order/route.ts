import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { capturePayPalOrder } from "../../../../lib/paypal";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(req: NextRequest) {
  // ── 1. Verify caller ─────────────────────────────────────────────────────
  const jwt = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = adminClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Parse body ────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const orderID = String(body.orderID ?? "").trim();
  if (!orderID) {
    return NextResponse.json({ error: "orderID is required" }, { status: 400 });
  }

  // ── 3. Verify the order belongs to this user ─────────────────────────────
  const { data: pending } = await supabase
    .from("donations")
    .select("id, donor_id, status, paypal_order_id")
    .eq("paypal_order_id", orderID)
    .eq("donor_id", user.id)
    .maybeSingle();

  if (!pending) {
    return NextResponse.json({ error: "Order not found or not authorised" }, { status: 403 });
  }

  if (pending.status === "confirmed") {
    // Idempotent — already captured (e.g. duplicate webhook + client call)
    return NextResponse.json({ donationId: pending.id, captureId: null, alreadyCaptured: true });
  }

  if (pending.status !== "pending") {
    return NextResponse.json({ error: "Order is not in a capturable state" }, { status: 409 });
  }

  // ── 4. Capture via PayPal ────────────────────────────────────────────────
  let result;
  try {
    result = await capturePayPalOrder(orderID);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "PayPal capture failed" },
      { status: 502 },
    );
  }

  // PayPal returns status 'COMPLETED' on success
  if (result.status !== "COMPLETED") {
    return NextResponse.json(
      { error: `Payment not completed. PayPal status: ${result.status}` },
      { status: 400 },
    );
  }

  // ── 5. Mark donation confirmed (via SECURITY DEFINER RPC) ────────────────
  const { data: donationId, error: rpcErr } = await supabase.rpc("confirm_paypal_donation", {
    p_paypal_order_id:   orderID,
    p_paypal_capture_id: result.captureId,
    p_provider_status:   result.status,
    p_donor_id:          user.id,
  });

  if (rpcErr) {
    return NextResponse.json(
      { error: rpcErr.message ?? "Failed to record payment confirmation" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    donationId: donationId ?? pending.id,
    captureId:  result.captureId,
    amount:     result.amountValue,
    currency:   result.currency,
  });
}
