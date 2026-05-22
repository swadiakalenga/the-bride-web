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

  // 1. Persist the notification row
  const { error } = await supabase.from("notifications").insert([{
    recipient_user_id: recipientUserId,
    actor_user_id:     actorUserId,
    type,
    post_id:           postId,
    comment_id:        commentId,
    conversation_id:   conversationId,
    church_id:         churchId,
    is_read:           false,
  }]);

  if (error) {
    console.error("[notification] insert error", { type, error });
    return;
  }

  // 2. Fire push — non-blocking, never propagates failure to the caller
  void firePush(params);
}

// ── Push delivery (fire-and-forget) ──────────────────────────────────────

async function firePush(params: NotificationParams): Promise<void> {
  try {
    // Need a valid session token to authenticate the API route
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

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

    await fetch("/api/push/send", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        user_id: params.recipientUserId,
        title,
        body,
        data,
      }),
    });
  } catch (err) {
    console.error("[push] delivery error", err);
  }
}
