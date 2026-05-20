"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type LiveStream = {
  id: string;
  church_id: string;
  broadcaster_id: string;
  title: string;
  status: string;
  viewer_count: number;
  started_at: string;
  recording_url: string | null;
};

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export default function LivePage() {
  const params = useParams();
  const router = useRouter();
  const streamId = params.id as string;

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [stream, setStream] = useState<LiveStream | null>(null);
  const [isBroadcaster, setIsBroadcaster] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [ending, setEnding] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ sender: string; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uiMessage, setUiMessage] = useState("");

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const signalingRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const metaRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const meRef = useRef<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    initPage();
    return () => cleanup();
  }, [streamId]);

  async function initPage() {
    const { data: authData } = await supabase.auth.getUser();
    const me = authData.user?.id;
    if (!me) { router.push("/login"); return; }
    setCurrentUserId(me);
    meRef.current = me;

    const { data: streamData } = await supabase
      .from("live_streams")
      .select("*")
      .eq("id", streamId)
      .maybeSingle();

    if (!streamData) {
      setUiMessage("This stream does not exist or is no longer available.");
      setLoading(false);
      return;
    }

    // Ended stream — show recording if available
    if (streamData.status === "ended") {
      setStream(streamData);
      setIsLive(false);
      setRecordingUrl(streamData.recording_url || null);
      setLoading(false);
      return;
    }

    setStream(streamData);
    setViewerCount(streamData.viewer_count || 0);

    if (streamData.broadcaster_id === me) {
      setIsBroadcaster(true);
      await startBroadcasting(me);
    } else {
      await startViewing(me);
    }

    setLoading(false);
  }

  const startBroadcasting = async (me: string) => {
    let mediaStream: MediaStream;
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch {
      setUiMessage("Could not access camera or microphone. Please grant permissions and try again.");
      setLoading(false);
      return;
    }

    localStreamRef.current = mediaStream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = mediaStream;
    }
    setCameraReady(true);

    // Start recording
    try {
      const recorder = new MediaRecorder(mediaStream, { mimeType: "video/webm;codecs=vp8,opus" });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(1000); // collect chunks every 1 second
      recorderRef.current = recorder;
    } catch {
      // Recording not supported — silently continue without it
    }

    const staleSignal = supabase.getChannels().find((c) => c.topic === `realtime:live-signal-${streamId}`);
    if (staleSignal) await supabase.removeChannel(staleSignal);

    const channel = supabase.channel(`live-signal-${streamId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "viewer-join" }, async ({ payload }) => {
        const viewerId: string = payload.viewer_id;
        if (peersRef.current.has(viewerId)) return;

        const pc = new RTCPeerConnection(ICE_SERVERS);
        peersRef.current.set(viewerId, pc);

        mediaStream.getTracks().forEach((t) => pc.addTrack(t, mediaStream));

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            channel.send({
              type: "broadcast",
              event: "ice-bc",
              payload: { target: viewerId, candidate: e.candidate.toJSON() },
            });
          }
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
            pc.close();
            peersRef.current.delete(viewerId);
            const c = peersRef.current.size;
            setViewerCount(c);
            supabase.from("live_streams").update({ viewer_count: c }).eq("id", streamId).then(() => {});
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        channel.send({
          type: "broadcast",
          event: "offer",
          payload: { target: viewerId, sdp: offer.sdp },
        });

        const c = peersRef.current.size;
        setViewerCount(c);
        supabase.from("live_streams").update({ viewer_count: c }).eq("id", streamId).then(() => {});
      })
      .on("broadcast", { event: "answer" }, async ({ payload }) => {
        const pc = peersRef.current.get(payload.viewer_id);
        if (pc && pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription({ type: "answer", sdp: payload.sdp });
        }
      })
      .on("broadcast", { event: "ice-viewer" }, async ({ payload }) => {
        const pc = peersRef.current.get(payload.viewer_id);
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      })
      .on("broadcast", { event: "chat" }, ({ payload }) => {
        // Broadcaster can see viewer chat messages
        setChatMessages((prev) => [...prev, { sender: payload.name, text: payload.text }]);
      })
      .subscribe();

    signalingRef.current = channel;
  };

  const startViewing = async (me: string) => {
    const staleSignal = supabase.getChannels().find((c) => c.topic === `realtime:live-signal-${streamId}`);
    if (staleSignal) await supabase.removeChannel(staleSignal);

    const channel = supabase.channel(`live-signal-${streamId}`, {
      config: { broadcast: { self: false } },
    });

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerRef.current = pc;

    pc.ontrack = (e) => {
      if (remoteVideoRef.current && e.streams[0]) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        channel.send({
          type: "broadcast",
          event: "ice-viewer",
          payload: { viewer_id: me, candidate: e.candidate.toJSON() },
        });
      }
    };

    channel
      .on("broadcast", { event: "offer" }, async ({ payload }) => {
        if (payload.target !== me) return;
        await pc.setRemoteDescription({ type: "offer", sdp: payload.sdp });
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        channel.send({
          type: "broadcast",
          event: "answer",
          payload: { viewer_id: me, sdp: answer.sdp },
        });
      })
      .on("broadcast", { event: "ice-bc" }, async ({ payload }) => {
        if (payload.target !== me) return;
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        }
      })
      .on("broadcast", { event: "stream-ended" }, () => {
        setIsLive(false);
        // Reload to get recording_url if available
        supabase.from("live_streams").select("recording_url").eq("id", streamId).maybeSingle().then(({ data }) => {
          setRecordingUrl(data?.recording_url || null);
        });
      })
      .on("broadcast", { event: "chat" }, ({ payload }) => {
        setChatMessages((prev) => [...prev, { sender: payload.name, text: payload.text }]);
      })
      .subscribe(() => {
        channel.send({
          type: "broadcast",
          event: "viewer-join",
          payload: { viewer_id: me },
        });
      });

    signalingRef.current = channel;

    const stale = supabase.getChannels().find((c) => c.topic === `realtime:live-meta-${streamId}`);
    if (stale) await supabase.removeChannel(stale);

    const meta = supabase
      .channel(`live-meta-${streamId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_streams", filter: `id=eq.${streamId}` },
        (payload) => {
          const row = payload.new as LiveStream;
          setViewerCount(row.viewer_count);
          if (row.status === "ended") {
            setIsLive(false);
            setRecordingUrl(row.recording_url || null);
          }
        }
      )
      .subscribe();

    metaRef.current = meta;
  };

  const endStream = async () => {
    if (ending) return;
    setEnding(true);

    // Notify viewers immediately
    try {
      signalingRef.current?.send({
        type: "broadcast",
        event: "stream-ended",
        payload: {},
      });
    } catch { /* ignore */ }

    // Try to stop recording with a 10s timeout — never block ending
    let recUrl: string | null = null;
    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        setUploading(true);
        recUrl = await Promise.race([
          stopAndUploadRecording(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000)),
        ]);
        setUploading(false);
      }
    } catch {
      recUrl = null;
      setUploading(false);
    }

    // Update DB — retry once if it fails
    const updatePayload = {
      status: "ended",
      ended_at: new Date().toISOString(),
      viewer_count: 0,
      ...(recUrl ? { recording_url: recUrl } : {}),
    };

    let { error: updateError } = await supabase
      .from("live_streams")
      .update(updatePayload)
      .eq("id", streamId);

    if (updateError) {
      // Retry once
      const retry = await supabase
        .from("live_streams")
        .update(updatePayload)
        .eq("id", streamId);
      updateError = retry.error;
    }

    cleanup();

    if (updateError) {
      setUiMessage("Stream ended locally, but the server update failed. Please return to the feed and refresh if the live badge remains visible.");
      setEnding(false);
      return;
    }

    router.push("/feed");
  };

  const stopAndUploadRecording = (): Promise<string | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === "inactive") { resolve(null); return; }

      let resolved = false;
      const done = (url: string | null) => {
        if (resolved) return;
        resolved = true;
        resolve(url);
      };

      // Fallback if onstop never fires
      setTimeout(() => done(null), 8000);

      recorder.onstop = async () => {
        try {
          const blob = new Blob(chunksRef.current, { type: "video/webm" });
          if (blob.size === 0) { done(null); return; }

          const path = `recordings/${streamId}-${Date.now()}.webm`;
          const { error } = await supabase.storage.from("media").upload(path, blob, { contentType: "video/webm" });
          if (error) { done(null); return; }

          const { data } = supabase.storage.from("media").getPublicUrl(path);
          done(data.publicUrl);
        } catch {
          done(null);
        }
      };

      try {
        recorder.stop();
      } catch {
        done(null);
      }
    });
  };

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setIsMuted((m) => !m);
  };

  const toggleCamera = () => {
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setCameraOff((c) => !c);
  };

  const sendChat = async () => {
    if (!chatInput.trim() || !currentUserId || isBroadcaster) return;
    const { data: p } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", currentUserId)
      .maybeSingle();

    signalingRef.current?.send({
      type: "broadcast",
      event: "chat",
      payload: { name: p?.full_name || "Someone", text: chatInput.trim() },
    });

    setChatMessages((prev) => [...prev, { sender: p?.full_name || "You", text: chatInput.trim() }]);
    setChatInput("");
  };

  function cleanup() {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    peerRef.current?.close();
    if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
    if (signalingRef.current) supabase.removeChannel(signalingRef.current);
    if (metaRef.current) supabase.removeChannel(metaRef.current);
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-red-500 border-t-transparent" />
      </div>
    );
  }

  if (uiMessage && !stream) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-black px-6 text-center text-white">
        <p className="max-w-sm text-sm text-gray-200">{uiMessage}</p>
        <button
          onClick={() => router.push("/feed")}
          className="rounded-full bg-white px-6 py-2 text-sm font-semibold text-black"
        >
          Back to Feed
        </button>
      </div>
    );
  }

  // Stream ended — show recording or ended screen
  if (!isLive && !isBroadcaster) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-black text-white px-6">
        <div className="text-5xl">{recordingUrl ? "🎬" : "📺"}</div>
        <p className="text-xl font-bold">{recordingUrl ? stream?.title || "Stream Recording" : "Stream has ended"}</p>

        {recordingUrl ? (
          <div className="w-full max-w-md">
            <video
              src={recordingUrl}
              controls
              className="w-full rounded-2xl bg-gray-900"
              style={{ maxHeight: "60vh" }}
            />
          </div>
        ) : (
          <p className="text-sm text-gray-400">The recording is not available.</p>
        )}

        <button
          onClick={() => router.push("/feed")}
          className="mt-2 rounded-full bg-white px-6 py-2 text-sm font-semibold text-black"
        >
          Back to Feed
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-black text-white">
      {uiMessage && (
        <div className="bg-red-600 px-4 py-2 text-center text-sm font-semibold text-white">
          {uiMessage}
        </div>
      )}

      {/* Video area */}
      <div className="relative flex-1 bg-black">
        {isBroadcaster ? (
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="h-full w-full object-cover"
          />
        ) : (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="h-full w-full object-cover"
          />
        )}

        {/* Top bar */}
        <div className="absolute left-0 right-0 top-0 flex items-center justify-between px-4 py-4" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)" }}>
          <button
            onClick={() => router.push("/feed")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-xs font-bold">
              <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
              LIVE
            </span>
            <span className="flex items-center gap-1 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold">
              👁 {viewerCount}
            </span>
          </div>

          {isBroadcaster && (
            <button
              onClick={endStream}
              disabled={ending || uploading}
              className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-bold"
            >
              {uploading ? "Saving..." : ending ? "Ending..." : "End"}
            </button>
          )}
        </div>

        {/* Stream title */}
        <div className="absolute left-4 top-16">
          <p className="rounded-full bg-black/50 px-3 py-1 text-sm font-semibold">
            {stream?.title}
          </p>
        </div>

        {/* Chat overlay — everyone sees chat */}
        <div className="absolute bottom-24 left-0 right-0 max-h-48 overflow-y-auto px-4 space-y-1">
          {chatMessages.slice(-20).map((m, i) => (
            <div key={i} className="inline-flex max-w-[80%] rounded-2xl bg-black/50 px-3 py-1.5">
              <span className="mr-1.5 text-xs font-bold text-brand-300">{m.sender}:</span>
              <span className="text-xs text-white">{m.text}</span>
            </div>
          ))}
        </div>

        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-6 pt-4" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)" }}>

          {/* Chat input — viewers only */}
          {!isBroadcaster && (
            <div className="mb-3 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }}
                placeholder="Say something..."
                className="flex-1 rounded-full bg-white/20 px-4 py-2 text-sm text-white placeholder-white/60 outline-none focus:bg-white/30"
              />
              <button
                onClick={sendChat}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              </button>
            </div>
          )}

          {/* Broadcaster controls */}
          {isBroadcaster && (
            <div className="flex justify-center gap-6">
              <button
                onClick={toggleMute}
                className={`flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-full text-xs font-medium ${isMuted ? "bg-red-500" : "bg-white/20"}`}
              >
                <span className="text-xl">{isMuted ? "🔇" : "🎤"}</span>
                <span className="text-[10px]">{isMuted ? "Unmute" : "Mute"}</span>
              </button>
              <button
                onClick={toggleCamera}
                className={`flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-full text-xs font-medium ${cameraOff ? "bg-red-500" : "bg-white/20"}`}
              >
                <span className="text-xl">{cameraOff ? "📵" : "📹"}</span>
                <span className="text-[10px]">{cameraOff ? "Show" : "Camera"}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
