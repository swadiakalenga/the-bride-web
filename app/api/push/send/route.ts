import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { firebaseEnvOk, getFcmAccessToken, sendFcmToTokens } from "../../../../lib/fcm";
import type { TokenRow } from "../../../../lib/fcm";

// ── Supabase admin client (service role — bypasses RLS) ───────────────────

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ── Types ─────────────────────────────────────────────────────────────────

type PushBody = {
  user_id:          string;
  title:            string;
  body:             string;
  data?:            Record<string, string>;
  // Required for user-JWT calls — must reference a real notification row
  // where recipient_user_id = user_id AND actor_user_id = authenticated caller
  notification_id?: string;
};

// ── GET — explicit 405 so health checks and browser probes get a clear response

export function GET() {
  return NextResponse.json({ error: "Use POST" }, { status: 405 });
}

// ── Authorization ─────────────────────────────────────────────────────────
//
// Allowed if EITHER:
//   A. x-internal-push-secret header matches INTERNAL_PUSH_SECRET env var
//      (server-to-server calls from API routes — e.g. notify-followers)
//   B. Authorization: Bearer <user_jwt> AND notification_id in body, where
//      the notifications row exists with:
//        recipient_user_id = user_id (push target)
//        actor_user_id     = authenticated user (the caller)
//
// This prevents any authenticated user from pushing arbitrary text to
// arbitrary users — the notification row acts as a proof-of-legitimacy.

// ── POST ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const db = adminDb();

  let parsed: PushBody;
  try {
    parsed = (await req.json()) as PushBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { user_id, title, body, data = {}, notification_id } = parsed;

  if (!user_id || !title || !body) {
    return NextResponse.json({ error: "Missing user_id, title, or body" }, { status: 400 });
  }

  // ── Path A: internal server-to-server secret ──────────────────────────
  const internalSecret = process.env.INTERNAL_PUSH_SECRET;
  const providedSecret = req.headers.get("x-internal-push-secret");

  if (internalSecret && providedSecret === internalSecret) {
    // Trusted server-side call — no further auth needed, proceed to FCM
    console.log("[push] auth mode: internal | target user:", user_id);
  } else {
    // ── Path B: user JWT + notification_id proof ─────────────────────
    const jwt = req.headers.get("Authorization")?.slice(7);
    if (!jwt) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: { user }, error: authErr } = await db.auth.getUser(jwt);
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!notification_id) {
      return NextResponse.json(
        { error: "notification_id is required for user-authenticated push requests" },
        { status: 403 },
      );
    }

    // Verify the notification row: recipient must be the push target,
    // and actor must be the authenticated caller.
    const { data: notifRow } = await db
      .from("notifications")
      .select("id")
      .eq("id", notification_id)
      .eq("recipient_user_id", user_id)
      .eq("actor_user_id", user.id)
      .maybeSingle();

    if (!notifRow) {
      return NextResponse.json(
        { error: "Forbidden — notification_id does not match caller or recipient" },
        { status: 403 },
      );
    }
    console.log("[push] auth mode: notification_id | target user:", user_id);
  }

  // Look up enabled device tokens for the recipient
  const { data: tokens, error: tokensErr } = await db
    .from("device_push_tokens")
    .select("id, token, platform")
    .eq("user_id", user_id)
    .eq("enabled", true);

  if (tokensErr) {
    console.error("[push] token lookup error", tokensErr);
    return NextResponse.json({ error: "Token lookup failed" }, { status: 500 });
  }

  if (!tokens || tokens.length === 0) {
    console.log("[push] no enabled tokens for user:", user_id);
    return NextResponse.json({ sent: 0, reason: "no_tokens" });
  }

  console.log("[push] token count:", tokens.length, "| user:", user_id);

  // FCM env vars — skip silently when not yet configured (e.g. local dev)
  if (!firebaseEnvOk()) {
    console.warn("[push] Firebase env vars not set — push skipped");
    return NextResponse.json({ sent: 0, reason: "firebase_not_configured" });
  }

  const fcmResults = await sendFcmToTokens(tokens as TokenRow[], { title, body, data }, db);

  const sent   = fcmResults.filter((r) => r.ok).length;
  const failed = fcmResults.filter((r) => !r.ok).length;

  console.log("[push] result: sent", sent, "failed", failed, "total", tokens.length, "| user:", user_id);

  return NextResponse.json({ sent, failed, total: tokens.length });
}

// Re-export getFcmAccessToken for internal use by other server routes
export { getFcmAccessToken };
