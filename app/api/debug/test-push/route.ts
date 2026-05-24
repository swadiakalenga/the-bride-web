// ── /api/debug/test-push ─────────────────────────────────────────────────
//
// Isolated Firebase/FCM smoke-test. Bypasses the full notification pipeline
// so you can confirm that Firebase credentials, device tokens, and FCM
// delivery are all working independently of the frontend push call chain.
//
// Auth:
//   - In development (NODE_ENV=development): no secret required.
//   - In all other environments: requires the x-internal-push-secret header.
//
// Usage:
//   curl -X POST https://www.thebride.app/api/debug/test-push \
//     -H "x-internal-push-secret: YOUR_SECRET" \
//     -H "Content-Type: application/json" \
//     -d '{"user_id":"TARGET_USER_UUID"}'
//
// Returns:
//   {
//     "token_count": 1,
//     "sent": 1,
//     "failed": 0,
//     "firebase_env_ok": true,
//     "platforms": ["android"],
//     "firebase_errors": []
//   }
//
// Does NOT log token values or secrets.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { firebaseEnvOk, sendFcmToTokens } from "../../../../lib/fcm";
import type { TokenRow } from "../../../../lib/fcm";

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export function GET() {
  return NextResponse.json({ error: "Use POST" }, { status: 405 });
}

export async function POST(req: NextRequest) {
  // ── Auth gate ─────────────────────────────────────────────────────────────
  const isDev = process.env.NODE_ENV === "development";
  const internalSecret = process.env.INTERNAL_PUSH_SECRET;
  const providedSecret = req.headers.get("x-internal-push-secret");

  if (!isDev) {
    if (!internalSecret) {
      // Secret not configured — route is unusable in production without it
      return NextResponse.json(
        { error: "INTERNAL_PUSH_SECRET is not set — cannot authenticate debug endpoint" },
        { status: 503 },
      );
    }
    if (providedSecret !== internalSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let user_id: string;
  try {
    const body = (await req.json()) as { user_id?: string };
    user_id = (body.user_id ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!user_id) {
    return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
  }

  console.log("[debug/test-push] requested for user:", user_id);

  const db = adminDb();

  // ── Token lookup ──────────────────────────────────────────────────────────
  const { data: tokens, error: tokensErr } = await db
    .from("device_push_tokens")
    .select("id, token, platform")
    .eq("user_id", user_id)
    .eq("enabled", true);

  if (tokensErr) {
    console.error("[debug/test-push] token lookup error:", tokensErr.message);
    return NextResponse.json(
      { error: "Token lookup failed", detail: tokensErr.message },
      { status: 500 },
    );
  }

  const tokenList = (tokens ?? []) as TokenRow[];
  const platforms  = tokenList.map((t) => t.platform);

  console.log("[debug/test-push] token_count:", tokenList.length, "platforms:", platforms);

  if (tokenList.length === 0) {
    return NextResponse.json({
      token_count:      0,
      sent:             0,
      failed:           0,
      firebase_env_ok:  firebaseEnvOk(),
      platforms:        [],
      firebase_errors:  [],
      note:             "No enabled device_push_tokens found for this user_id. " +
                        "The device must register a token via the FCM SDK before push can be delivered.",
    });
  }

  // ── Firebase env check ────────────────────────────────────────────────────
  const fbOk = firebaseEnvOk();
  console.log("[debug/test-push] firebase_env_ok:", fbOk);

  if (!fbOk) {
    return NextResponse.json({
      token_count:     tokenList.length,
      sent:            0,
      failed:          0,
      firebase_env_ok: false,
      platforms,
      firebase_errors: [],
      note:            "Firebase env vars missing: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, " +
                       "or FIREBASE_PRIVATE_KEY. Add them to Vercel environment variables.",
    });
  }

  // ── Send test push via FCM ────────────────────────────────────────────────
  let fcmResults;
  try {
    fcmResults = await sendFcmToTokens(
      tokenList,
      {
        title: "TheBride — Push Test",
        body:  "If you see this, FCM delivery is working.",
        data:  { type: "debug_test" },
      },
      db,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[debug/test-push] FCM error:", msg);
    return NextResponse.json(
      { error: "FCM send failed", detail: msg, firebase_env_ok: true, token_count: tokenList.length },
      { status: 500 },
    );
  }

  const sent   = fcmResults.filter((r) => r.ok).length;
  const failed = fcmResults.filter((r) => !r.ok).length;

  // Collect error details (platform + error code/message, no token strings)
  const firebase_errors = fcmResults
    .filter((r) => !r.ok)
    .map((r) => ({
      platform:  r.platform,
      errorCode: r.errorCode ?? null,
      errorMsg:  r.errorMsg  ?? null,
    }));

  console.log("[debug/test-push] result: sent", sent, "failed", failed,
    "token_count", tokenList.length, "firebase_errors:", firebase_errors);

  return NextResponse.json({
    token_count:     tokenList.length,
    sent,
    failed,
    firebase_env_ok: true,
    platforms,
    firebase_errors,
  });
}
