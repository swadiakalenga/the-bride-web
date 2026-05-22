import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ── Supabase admin client (service role — bypasses RLS) ───────────────────

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ── FCM v1 JWT helper ─────────────────────────────────────────────────────

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\n/g, "");
  const binary = Buffer.from(b64, "base64");
  const ab = new ArrayBuffer(binary.length);
  new Uint8Array(ab).set(binary);
  return ab;
}

function b64url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj))
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function getFcmAccessToken(): Promise<string> {
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL ?? "";

  const now = Math.floor(Date.now() / 1000);
  const header = b64url({ alg: "RS256", typ: "JWT" });
  const claims = b64url({
    iss: clientEmail,
    sub: clientEmail,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  });

  const signingInput = `${header}.${claims}`;

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  const sigB64 = Buffer.from(sig)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${signingInput}.${sigB64}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const { access_token } = (await tokenRes.json()) as { access_token: string };
  return access_token;
}

// ── Route handler ─────────────────────────────────────────────────────────

type PushBody = {
  user_id: string;
  title:   string;
  body:    string;
  data?:   Record<string, string>;
};

type TokenRow = { id: string; token: string; platform: string };

export async function POST(req: NextRequest) {
  // Verify caller has a valid Supabase session (same pattern as stripe routes)
  const jwt = req.headers.get("Authorization")?.slice(7);
  if (!jwt) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = adminDb();
  const { data: { user }, error: authErr } = await db.auth.getUser(jwt);
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { user_id, title, body, data = {} } = (await req.json()) as PushBody;

  if (!user_id || !title || !body) {
    return NextResponse.json({ error: "Missing user_id, title, or body" }, { status: 400 });
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
    return NextResponse.json({ sent: 0, reason: "no_tokens" });
  }

  // FCM env vars — if not configured, skip silently rather than crash
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    console.warn("[push] Firebase env vars not set — push skipped");
    return NextResponse.json({ sent: 0, reason: "firebase_not_configured" });
  }

  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const accessToken = await getFcmAccessToken();
  const fcmUrl      = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const results = await Promise.allSettled(
    (tokens as TokenRow[]).map(async (row) => {
      const res = await fetch(fcmUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: row.token,
            notification: { title, body },
            data,
            android: {
              priority: "high",
              notification: {
                channel_id: "thebride_notifications",
                sound: "default",
                icon: "ic_launcher",
              },
            },
            apns: {
              payload: {
                aps: { alert: { title, body }, badge: 1, sound: "default" },
              },
            },
          },
        }),
      });

      const json = (await res.json()) as {
        name?: string;
        error?: {
          message?: string;
          details?: { errorCode?: string }[];
        };
      };

      if (!res.ok) {
        const errCode = json.error?.details?.[0]?.errorCode;
        // Remove stale tokens automatically
        if (errCode === "UNREGISTERED" || errCode === "INVALID_ARGUMENT") {
          await db.from("device_push_tokens").delete().eq("id", row.id);
        }
        throw new Error(json.error?.message ?? `FCM ${res.status}`);
      }

      return json.name;
    }),
  );

  const sent   = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({ sent, failed, total: tokens.length });
}
