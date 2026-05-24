// Shared Firebase Cloud Messaging (FCM v1) helper.
// Used by /api/push/send and /api/debug/test-push.
// Never logs token values.

import type { SupabaseClient } from "@supabase/supabase-js";

// ── Internal JWT helpers ──────────────────────────────────────────────────

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

// ── OAuth2 access token for FCM v1 API ───────────────────────────────────

export async function getFcmAccessToken(): Promise<string> {
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
      assertion:  jwt,
    }),
  });

  const json = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!json.access_token) {
    throw new Error(`FCM token exchange failed: ${json.error ?? "no access_token returned"}`);
  }
  return json.access_token;
}

// ── Check Firebase env vars ───────────────────────────────────────────────

export function firebaseEnvOk(): boolean {
  return !!(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  );
}

// ── Types ─────────────────────────────────────────────────────────────────

export type TokenRow = { id: string; token: string; platform: string };

export type FcmResult = {
  tokenId:    string;           // row.id (not the FCM token string)
  platform:   string;
  ok:         boolean;
  errorCode?: string;
  errorMsg?:  string;
};

export type FcmMessage = {
  title: string;
  body:  string;
  data?: Record<string, string>;
};

// ── Core send function ────────────────────────────────────────────────────
// Sends to every token in the list. Stale tokens (UNREGISTERED / INVALID_ARGUMENT)
// are deleted from device_push_tokens automatically.
// Never logs token string values.

export async function sendFcmToTokens(
  tokens:  TokenRow[],
  message: FcmMessage,
  db:      SupabaseClient,
): Promise<FcmResult[]> {
  const projectId   = process.env.FIREBASE_PROJECT_ID!;
  const accessToken = await getFcmAccessToken();
  const fcmUrl      = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const { title, body, data = {} } = message;

  const results = await Promise.allSettled(
    tokens.map(async (row): Promise<FcmResult> => {
      const fcmRes = await fetch(fcmUrl, {
        method: "POST",
        headers: {
          Authorization:  `Bearer ${accessToken}`,
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
                sound:      "default",
                icon:       "ic_launcher",
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

      const json = (await fcmRes.json()) as {
        name?: string;
        error?: { message?: string; details?: { errorCode?: string }[] };
      };

      if (!fcmRes.ok) {
        const errCode = json.error?.details?.[0]?.errorCode;
        const errMsg  = json.error?.message ?? `HTTP ${fcmRes.status}`;

        // Remove stale tokens so future pushes don't waste calls on them
        if (errCode === "UNREGISTERED" || errCode === "INVALID_ARGUMENT") {
          await db.from("device_push_tokens").delete().eq("id", row.id);
        }

        return { tokenId: row.id, platform: row.platform, ok: false, errorCode: errCode, errorMsg: errMsg };
      }

      return { tokenId: row.id, platform: row.platform, ok: true };
    }),
  );

  return results.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : { tokenId: "unknown", platform: "unknown", ok: false, errorMsg: String(r.reason) },
  );
}
