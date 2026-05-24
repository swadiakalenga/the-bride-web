import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Body = {
  live_event_id: string;
  church_id: string;
  notification_type: "church_live_started" | "church_live_scheduled";
};

export async function POST(req: NextRequest) {
  const jwt = req.headers.get("Authorization")?.slice(7);
  if (!jwt) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = adminDb();

  // Verify caller
  const { data: { user }, error: authErr } = await db.auth.getUser(jwt);
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify caller is church_admin for this church
  let body: Body;
  try { body = await req.json() as Body; }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { live_event_id, church_id, notification_type } = body;
  if (!live_event_id || !church_id || !notification_type) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { data: profile } = await db
    .from("profiles")
    .select("role, church_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "church_admin" || profile?.church_id !== church_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get all church followers
  const { data: followers, error: followErr } = await db
    .from("church_follows")
    .select("user_id")
    .eq("church_id", church_id);

  if (followErr) {
    console.error("[live-notify] follower query error", followErr);
    return NextResponse.json({ error: "Failed to fetch followers" }, { status: 500 });
  }

  if (!followers || followers.length === 0) {
    return NextResponse.json({ notified: 0 });
  }

  // Bulk insert notification rows (service role bypasses RLS actor check)
  const notificationRows = followers.map((f: { user_id: string }) => ({
    recipient_user_id: f.user_id,
    actor_user_id:     user.id,
    type:              notification_type,
    conversation_id:   null,
    post_id:           null,
    comment_id:        null,
    church_id,
    is_read:           false,
  }));

  const { error: notifErr } = await db.from("notifications").insert(notificationRows);
  if (notifErr) {
    console.error("[live-notify] notification insert error", notifErr);
    return NextResponse.json({ error: "Notification insert failed" }, { status: 500 });
  }

  // Fire push notifications for each follower (capped at 200 for Phase 1)
  const origin = new URL(req.url).origin;
  const recipients = followers.slice(0, 200) as { user_id: string }[];

  const title =
    notification_type === "church_live_started"
      ? "🔴 Your church is live!"
      : "📅 Stream scheduled";
  const pushBody =
    notification_type === "church_live_started"
      ? "Join the stream now"
      : "A new live event has been scheduled";

  // Use internal push secret for server-to-server calls — bypasses the
  // notification_id proof-of-legitimacy check (this route already verified
  // the caller is a church_admin with matching church_id above).
  const internalSecret = process.env.INTERNAL_PUSH_SECRET;

  if (!internalSecret) {
    console.warn("[live-notify] INTERNAL_PUSH_SECRET not set — push notifications skipped for live event");
  } else {
    await Promise.allSettled(
      recipients.map((f) =>
        fetch(`${origin}/api/push/send`, {
          method: "POST",
          headers: {
            "Content-Type":           "application/json",
            "x-internal-push-secret": internalSecret,
          },
          body: JSON.stringify({
            user_id: f.user_id,
            title,
            body: pushBody,
            data: {
              type: notification_type,
              live_event_id,
              church_id,
            },
          }),
        }).catch((err) => {
          console.error("[live-notify] push fetch error for recipient:", err);
        }),
      ),
    );
  }

  console.log(`[live-notify] notified ${recipients.length} followers of ${church_id} — ${notification_type}`);
  return NextResponse.json({ notified: recipients.length });
}
