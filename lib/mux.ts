// Server-only — never import this in a client component or "use client" file.

const MUX_BASE = "https://api.mux.com";

function auth(): string {
  const id = process.env.MUX_TOKEN_ID;
  const secret = process.env.MUX_TOKEN_SECRET;
  if (!id || !secret) throw new Error("MUX_TOKEN_ID and MUX_TOKEN_SECRET env vars are required");
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

export type MuxLiveStream = {
  live_stream_id: string;
  stream_key: string;
  playback_id: string;
  hls_url: string;
};

type MuxApiStream = {
  id: string;
  stream_key: string;
  playback_ids: { id: string; policy: string }[];
  status: string;
};

export async function createMuxLiveStream(): Promise<MuxLiveStream> {
  const res = await fetch(`${MUX_BASE}/video/v1/live-streams`, {
    method: "POST",
    headers: { Authorization: auth(), "Content-Type": "application/json" },
    body: JSON.stringify({
      playback_policy: ["public"],
      new_asset_settings: { playback_policy: ["public"] },
      reconnect_window: 60,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mux create live stream failed (${res.status}): ${text}`);
  }

  const { data } = (await res.json()) as { data: MuxApiStream };
  const playback_id = data.playback_ids[0]?.id;
  if (!playback_id) throw new Error("Mux returned no playback ID");

  return {
    live_stream_id: data.id,
    stream_key: data.stream_key,
    playback_id,
    hls_url: buildMuxHlsUrl(playback_id),
  };
}

export async function getMuxLiveStream(liveStreamId: string): Promise<MuxApiStream> {
  const res = await fetch(`${MUX_BASE}/video/v1/live-streams/${liveStreamId}`, {
    headers: { Authorization: auth() },
  });
  if (!res.ok) throw new Error(`Mux get live stream failed (${res.status})`);
  const { data } = (await res.json()) as { data: MuxApiStream };
  return data;
}

export async function disableMuxLiveStream(liveStreamId: string): Promise<void> {
  const res = await fetch(`${MUX_BASE}/video/v1/live-streams/${liveStreamId}/disable`, {
    method: "PUT",
    headers: { Authorization: auth() },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mux disable live stream failed (${res.status}): ${text}`);
  }
}

export function buildMuxHlsUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}
