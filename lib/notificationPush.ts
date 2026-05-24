// Universal notification helper.
// Use this everywhere instead of inserting into the notifications table directly.
//
// It:
//   1. Inserts the notification row
//   2. Looks up the actor's display name
//   3. Fires push delivery via /api/push/send (Vercel API route → FCM)
//   4. Skips if recipient === actor (no self-notifications)

import { supabase } from "./supabase";

export type NotificationParams = {
  recipientUserId:  string;
  actorUserId:      string;
  type:             string;
  postId?:          string | null;
  commentId?:       string | null;
  conversationId?:  string | null;
  churchId?:        string | null;
};

// ── Push payload builder ──────────────────────────────────────────────────

type PushPayload = { title: string; body: string };

function buildPushPayload(type: string, actorName: string): PushPayload {
  const n = actorName || "Someone";
  const map: Record<string, PushPayload> = {
    // Messaging
    message:             { title: "New message",          body: `${n} sent you a message` },
    message_request:     { title: "Message request",      body: `${n} sent you a message request` },
    // Social
    follow:              { title: "New follower",         body: `${n} started following you` },
    like:                { title: "New like",             body: `${n} liked your post` },
    comment:             { title: "New comment",          body: `${n} commented on your post` },
    reply:               { title: "New reply",            body: `${n} replied to your comment` },
    tag:                 { title: "Mentioned",            body: `${n} mentioned you in a post` },
    prayer:              { title: "Prayer",               body: `${n} prayed for your request` },
    event:               { title: "New event",            body: "New event in your church" },
    // Church membership
    membership_request:  { title: "Membership request",  body: `${n} wants to join your church` },
    membership_approved: { title: "Membership approved",  body: "Your membership request was approved" },
    membership_rejected: { title: "Membership update",    body: "Your membership request was not approved" },
    // Church verification
    church_verified:     { title: "Church verified ✓",   body: "Your church has been verified" },
    church_rejected:     { title: "Verification update", body: "Your church verification was not approved" },
    // Giving
    donation_received:      { title: "Donation received",   body: `${n} made a donation` },
    tithe_received:         { title: "Tithe received",      body: `${n} gave their tithe` },
    offering_received:      { title: "Offering received",   body: `${n} gave an offering` },
    // Church livestream
    church_live_started:    { title: "🔴 Your church is live!", body: `Join the stream now` },
    church_live_scheduled:  { title: "📅 Stream scheduled",     body: `A new live event has been scheduled` },
  };
  return map[type] ?? { title: "TheBride", body: "You have a new notification" };
}

// ── In-app debug overlay ──────────────────────────────────────────────────
// Visible floating panel rendered in the app UI.
// Enable by setting NEXT_PUBLIC_DEBUG_PUSH=true at build time.
// Do NOT enable in production — remove the env var before the release build.

const DEBUG_PUSH = process.env.NEXT_PUBLIC_DEBUG_PUSH === "true";

function pushDebugLog(msg: string, ok = true): void {
  // Always write to console regardless of DEBUG_PUSH
  if (ok) {
    console.log("[notify]", msg);
  } else {
    console.error("[notify]", msg);
  }

  if (!DEBUG_PUSH) return;
  if (typeof document === "undefined") return;

  let panel = document.getElementById("__push_debug_panel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "__push_debug_panel";
    panel.setAttribute(
      "style",
      "position:fixed;bottom:72px;left:6px;right:6px;z-index:99999;" +
      "background:rgba(0,0,0,0.9);border-radius:10px;padding:8px 10px;" +
      "font:11px/1.5 monospace;max-height:240px;overflow-y:auto;" +
      "border:1px solid rgba(251,191,36,0.4);",
    );

    const hdr = document.createElement("div");
    hdr.setAttribute("style", "display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;");

    const title = document.createElement("span");
    title.setAttribute("style", "color:#fbbf24;font-weight:bold;font-size:12px;");
    title.textContent = "🔔 Push Debug";

    const btn = document.createElement("button");
    btn.textContent = "✕";
    btn.setAttribute(
      "style",
      "background:none;border:none;color:#9ca3af;font-size:14px;cursor:pointer;padding:0 2px;line-height:1;",
    );
    btn.onclick = () => { document.getElementById("__push_debug_panel")?.remove(); };

    hdr.appendChild(title);
    hdr.appendChild(btn);
    panel.appendChild(hdr);
    document.body.appendChild(panel);
  }

  const line = document.createElement("div");
  line.setAttribute(
    "style",
    `color:${ok ? "#4ade80" : "#f87171"};padding:1px 0;` +
    "border-top:1px solid rgba(255,255,255,0.06);word-break:break-all;",
  );
  const ts = new Date().toISOString().slice(11, 23);
  line.textContent = `${ts} ${ok ? "✓" : "✗"} ${msg}`;
  panel.appendChild(line);
  panel.scrollTop = panel.scrollHeight;
}

// ── Core helper ───────────────────────────────────────────────────────────

export async function createNotification(params: NotificationParams): Promise<void> {
  const {
    recipientUserId,
    actorUserId,
    type,
    postId          = null,
    commentId       = null,
    conversationId  = null,
    churchId        = null,
  } = params;

  // Never send to yourself
  if (!recipientUserId || recipientUserId === actorUserId) return;

  pushDebugLog(`createNotification type=${type} recipient=${recipientUserId.slice(0, 8)}…`);

  // 1. Persist the notification row — select the id back so we can pass it
  //    to the push endpoint as proof of a legitimate notification.
  const { data: notifRow, error } = await supabase
    .from("notifications")
    .insert([{
      recipient_user_id: recipientUserId,
      actor_user_id:     actorUserId,
      type,
      post_id:           postId,
      comment_id:        commentId,
      conversation_id:   conversationId,
      church_id:         churchId,
      is_read:           false,
    }])
    .select("id")
    .single();

  if (error) {
    pushDebugLog(`notification insert FAILED: ${error.message}`, false);
    return;
  }

  pushDebugLog(`notification insert OK id=${notifRow.id.slice(0, 8)}…`);

  // 2. Fire push — non-blocking, never propagates failure to the caller
  void firePush(params, notifRow.id);
}

// ── Push delivery (fire-and-forget) ──────────────────────────────────────

async function firePush(params: NotificationParams, notificationId: string): Promise<void> {
  try {
    // Need a valid session token to authenticate the API route.
    // Uses supabase.auth.getSession() which reads from localStorage in Capacitor WebView.
    const { data: { session }, error: sessionErr } = await supabase.auth.getSession();

    const hasToken = !!session?.access_token;
    pushDebugLog(`session access_token: ${hasToken ? "YES" : "NO"}${sessionErr ? ` (err: ${sessionErr.message})` : ""}`, hasToken);

    if (!hasToken) {
      pushDebugLog("push aborted — no session token", false);
      return;
    }

    // Look up actor's display name for a personalised push body
    const { data: actor } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", params.actorUserId)
      .maybeSingle();
    const actorName = actor?.full_name ?? "Someone";

    const { title, body } = buildPushPayload(params.type, actorName);

    // Deep-link routing data forwarded to the app on notification tap
    const data: Record<string, string> = { type: params.type };
    if (params.postId)         data.post_id         = params.postId;
    if (params.commentId)      data.comment_id      = params.commentId;
    if (params.conversationId) data.conversation_id = params.conversationId;
    if (params.churchId)       data.church_id       = params.churchId;

    // ── Absolute URL resolution ───────────────────────────────────────────
    // CRITICAL: must be an absolute URL so the request reaches Vercel from
    // both web browsers and Capacitor WebViews (where window.location.origin
    // is "capacitor://localhost" or "https://localhost", not the Vercel host).
    //
    // Set NEXT_PUBLIC_SITE_URL=https://your-domain.com in Vercel env vars
    // AND in .env.local so it is baked into the APK bundle at build time.
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

    if (!siteUrl) {
      pushDebugLog(
        "NEXT_PUBLIC_SITE_URL is not set — push will fail in Capacitor (window.location.origin=" +
        (typeof window !== "undefined" ? window.location.origin : "SSR") + ")",
        false,
      );
      // Bail rather than use a Capacitor-local URL that will never reach Vercel
      return;
    }

    const pushUrl = `${siteUrl}/api/push/send`;
    pushDebugLog(`fetch → ${pushUrl}`);

    const res = await fetch(pushUrl, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${session!.access_token}`,
      },
      body: JSON.stringify({
        user_id:         params.recipientUserId,
        notification_id: notificationId,
        title,
        body,
        data,
      }),
    });

    let responseBody = "";
    try { responseBody = await res.text(); } catch { /* ignore */ }

    pushDebugLog(`response ${res.status} ${res.ok ? "OK" : "ERR"} — ${responseBody.slice(0, 80)}`, res.ok);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    pushDebugLog(`push delivery error: ${msg}`, false);
  }
}
