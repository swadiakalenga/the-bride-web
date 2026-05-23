import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createMuxLiveStream } from "../../../../lib/mux";

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type Body = {
  churchId: string;
  title: string;
  description?: string;
  scheduledFor?: string;
};

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const jwt = req.headers.get("Authorization")?.slice(7);
  if (!jwt) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = adminDb();
  const { data: { user }, error: authErr } = await db.auth.getUser(jwt);
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: Body;
  try { body = (await req.json()) as Body; }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { churchId, title, description, scheduledFor } = body;
  if (!churchId || !title?.trim()) {
    return NextResponse.json({ error: "churchId and title are required" }, { status: 400 });
  }

  // ── Verify caller is church_admin for this church ─────────────────────────
  const { data: profile } = await db
    .from("profiles")
    .select("role, church_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "church_admin" || profile?.church_id !== churchId) {
    return NextResponse.json({ error: "Forbidden: not church admin for this church" }, { status: 403 });
  }

  // ── Create Mux live stream ─────────────────────────────────────────────────
  let mux;
  try {
    mux = await createMuxLiveStream();
  } catch (err) {
    return NextResponse.json(
      { error: `Mux error: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  // ── Insert church_live_events row ─────────────────────────────────────────
  const row: Record<string, unknown> = {
    church_id:       churchId,
    created_by:      user.id,
    title:           title.trim(),
    status:          "scheduled",
    stream_input_id: mux.live_stream_id,
    stream_key:      mux.stream_key,
    playback_id:     mux.playback_id,
    hls_url:         mux.hls_url,
    playback_url:    mux.hls_url,
    provider:        "mux",
    replay_enabled:  true,
  };
  if (description?.trim()) row.description = description.trim();
  if (scheduledFor)         row.scheduled_for = scheduledFor;

  const { data: event, error: insertErr } = await db
    .from("church_live_events")
    .insert([row])
    .select("id")
    .single();

  if (insertErr || !event) {
    return NextResponse.json(
      { error: `DB insert failed: ${insertErr?.message ?? "unknown"}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    eventId:         event.id,
    streamServerUrl: "rtmps://global-live.mux.com:443/app",
    streamKey:       mux.stream_key,
    playbackUrl:     mux.hls_url,
  });
}
