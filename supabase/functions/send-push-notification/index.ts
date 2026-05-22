// Supabase Edge Function — send-push-notification
// Triggered by lib/notificationPush.ts after every notifications table insert.
// Looks up device tokens for the recipient and delivers via Firebase FCM v1 API.
//
// Required Supabase secrets:
//   FIREBASE_PROJECT_ID    — Firebase project id (e.g. "thebride-12345")
//   FIREBASE_CLIENT_EMAIL  — Service account client_email from JSON key file
//   FIREBASE_PRIVATE_KEY   — Service account private_key (PEM, with literal \n)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Push payload builder ──────────────────────────────────────────────────

type PushPayload = { title: string; body: string };

function buildPayload(type: string, actorName: string): PushPayload {
  const n = actorName || "Someone";
  const map: Record<string, PushPayload> = {
    // Messaging
    message:          { title: "New message",          body: `${n} sent you a message` },
    message_request:  { title: "Message request",      body: `${n} sent you a message request` },
    // Social
    follow:           { title: "New follower",         body: `${n} started following you` },
    like:             { title: "New like",             body: `${n} liked your post` },
    comment:          { title: "New comment",          body: `${n} commented on your post` },
    reply:            { title: "New reply",            body: `${n} replied to your comment` },
    tag:              { title: "Mentioned",            body: `${n} mentioned you in a post` },
    prayer:           { title: "Prayer",               body: `${n} prayed for your request` },
    event:            { title: "New event",            body: "New event in your church" },
    // Church membership
    membership_request:  { title: "Membership request",  body: `${n} wants to join your church` },
    membership_approved: { title: "Membership approved",  body: "Your membership request was approved" },
    membership_rejected: { title: "Membership update",    body: "Your membership request was not approved" },
    // Church verification
    church_verified:  { title: "Church verified ✓",    body: "Your church has been verified" },
    church_rejected:  { title: "Verification update",  body: "Your church verification was not approved" },
    // Giving
    donation_received: { title: "Donation received",   body: `${n} made a donation` },
    tithe_received:    { title: "Tithe received",      body: `${n} gave their tithe` },
    offering_received: { title: "Offering received",   body: `${n} gave an offering` },
  };
  return map[type] ?? { title: "TheBride", body: "You have a new notification" };
}

// ── FCM v1 API helpers ────────────────────────────────────────────────────

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\n/g, "");
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

function b64url(obj: unknown): string {
  return btoa(JSON.stringify(obj))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function getFcmAccessToken(): Promise<string> {
  const privateKey = (Deno.env.get("FIREBASE_PRIVATE_KEY") ?? "").replace(/\\n/g, "\n");
  const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL") ?? "";

  const now = Math.floor(Date.now() / 1000);
  const jwtHeader = b64url({ alg: "RS256", typ: "JWT" });
  const jwtClaims = b64url({
    iss: clientEmail,
    sub: clientEmail,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  });

  const signingInput = `${jwtHeader}.${jwtClaims}`;
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
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
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

  const { access_token } = await tokenRes.json() as { access_token: string };
  return access_token;
}

// ── Request body type ─────────────────────────────────────────────────────

type RequestBody = {
  recipient_user_id: string;
  actor_user_id?:    string | null;
  type:              string;
  actor_name?:       string | null;
  post_id?:          string | null;
  comment_id?:       string | null;
  conversation_id?:  string | null;
  church_id?:        string | null;
};

// ── Handler ───────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const body = (await req.json()) as RequestBody;
    const { recipient_user_id, actor_user_id, type } = body;

    if (!recipient_user_id || !type) {
      return new Response(JSON.stringify({ error: "Missing recipient_user_id or type" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Supabase admin client (bypasses RLS — needed to read device tokens)
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Lookup actor name if not supplied
    let actorName = body.actor_name ?? "";
    if (!actorName && actor_user_id) {
      const { data: actor } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", actor_user_id)
        .maybeSingle();
      actorName = actor?.full_name ?? "";
    }

    // Lookup enabled device tokens for recipient
    const { data: tokens, error: tokensErr } = await admin
      .from("device_push_tokens")
      .select("id, token, platform")
      .eq("user_id", recipient_user_id)
      .eq("enabled", true);

    if (tokensErr || !tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_tokens" }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Build push payload
    const { title, body: bodyText } = buildPayload(type, actorName);

    // Deep-link data forwarded to the app on tap
    const data: Record<string, string> = { type };
    if (body.post_id)         data.post_id         = body.post_id;
    if (body.comment_id)      data.comment_id      = body.comment_id;
    if (body.conversation_id) data.conversation_id = body.conversation_id;
    if (body.church_id)       data.church_id       = body.church_id;

    const projectId   = Deno.env.get("FIREBASE_PROJECT_ID")!;
    const accessToken = await getFcmAccessToken();
    const fcmUrl      = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    // Send to each token, collect results
    type TokenRow = { id: string; token: string; platform: string };
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
              notification: { title, body: bodyText },
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
                  aps: { alert: { title, body: bodyText }, badge: 1, sound: "default" },
                },
              },
            },
          }),
        });

        const json = await res.json() as {
          name?: string;
          error?: { code: number; message: string; status: string; details?: { errorCode?: string }[] };
        };

        if (!res.ok) {
          // Remove stale/unregistered tokens so they don't accumulate
          const errCode = json.error?.details?.[0]?.errorCode;
          if (errCode === "UNREGISTERED" || errCode === "INVALID_ARGUMENT") {
            await admin.from("device_push_tokens").delete().eq("id", row.id);
          }
          throw new Error(json.error?.message ?? `FCM ${res.status}`);
        }

        return json.name; // FCM message name on success
      }),
    );

    const sent   = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return new Response(JSON.stringify({ sent, failed, total: tokens.length }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-push-notification] unhandled error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
