import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { disableMuxLiveStream } from "../../../../lib/mux";

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const jwt = req.headers.get("Authorization")?.slice(7);
  if (!jwt) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = adminDb();
  const { data: { user }, error: authErr } = await db.auth.getUser(jwt);
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { eventId: string };
  try { body = (await req.json()) as { eventId: string }; }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { eventId } = body;
  if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });

  // ── Fetch event and verify ownership ─────────────────────────────────────
  const { data: event } = await db
    .from("church_live_events")
    .select("id, church_id, status, stream_input_id, provider")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const { data: profile } = await db
    .from("profiles")
    .select("role, church_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "church_admin" || profile?.church_id !== event.church_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (event.status === "ended") {
    return NextResponse.json({ ok: true, already: true });
  }

  // ── Disable Mux stream ────────────────────────────────────────────────────
  if (event.stream_input_id && event.provider === "mux") {
    try {
      await disableMuxLiveStream(event.stream_input_id);
    } catch {
      // Non-fatal — still mark ended in DB even if Mux call fails
    }
  }

  // ── Mark ended ────────────────────────────────────────────────────────────
  const now = new Date().toISOString();
  const { error: updateErr } = await db
    .from("church_live_events")
    .update({ status: "ended", ended_at: now, replay_enabled: true })
    .eq("id", eventId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
