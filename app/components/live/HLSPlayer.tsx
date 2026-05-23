"use client";

import { useEffect, useRef, useState } from "react";

type HLSPlayerProps = {
  hlsUrl: string;
  poster?: string | null;
  autoPlay?: boolean;
  onError?: () => void;
};

type PlayerState = "loading" | "playing" | "error" | "ended";

export default function HLSPlayer({ hlsUrl, poster, autoPlay = true, onError }: HLSPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [state, setState] = useState<PlayerState>("loading");
  const [muted, setMuted] = useState(true); // start muted for autoplay policy compliance
  const [retryCount, setRetryCount] = useState(0);
  const hlsRef = useRef<import("hls.js").default | null>(null);

  useEffect(() => {
    if (!hlsUrl || !videoRef.current) return;
    const video = videoRef.current;
    let destroyed = false;

    const init = async () => {
      const Hls = (await import("hls.js")).default;

      // Destroy any existing HLS instance
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
          maxBufferLength: 60,
          maxMaxBufferLength: 120,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 8,
        });

        hlsRef.current = hls;

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (destroyed) return;
          setState("loading");
          if (autoPlay) video.play().catch(() => {});
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (destroyed) return;
          if (data.fatal) {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              // Attempt reconnect on network error (common on Android)
              hls.startLoad();
            } else {
              setState("error");
              onError?.();
            }
          }
        });

        hls.loadSource(hlsUrl);
        hls.attachMedia(video);
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Native HLS (Safari / iOS)
        video.src = hlsUrl;
        if (autoPlay) video.play().catch(() => {});
      } else {
        setState("error");
        onError?.();
      }
    };

    void init();

    return () => {
      destroyed = true;
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [hlsUrl, autoPlay, onError, retryCount]);

  const handleRetry = () => {
    setState("loading");
    setRetryCount((c) => c + 1);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !muted;
    setMuted(!muted);
  };

  const requestFullscreen = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.requestFullscreen) el.requestFullscreen();
    else if ((el as HTMLVideoElement & { webkitEnterFullscreen?: () => void }).webkitEnterFullscreen) {
      (el as HTMLVideoElement & { webkitEnterFullscreen: () => void }).webkitEnterFullscreen();
    }
  };

  return (
    <div className="relative w-full overflow-hidden bg-black" style={{ aspectRatio: "16/9" }}>
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        poster={poster ?? undefined}
        muted={muted}
        playsInline
        autoPlay={autoPlay}
        onCanPlay={() => setState("playing")}
        onWaiting={() => setState("loading")}
        onPlaying={() => setState("playing")}
        onEnded={() => setState("ended")}
        onError={(e) => {
          const err = (e.target as HTMLVideoElement).error;
          if (err && err.code !== MediaError.MEDIA_ERR_ABORTED) setState("error");
        }}
      />

      {/* Loading spinner */}
      {state === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
        </div>
      )}

      {/* Error state */}
      {state === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80">
          <span className="text-4xl">📡</span>
          <p className="text-center text-sm font-medium text-white">Stream unavailable</p>
          <p className="text-center text-xs text-gray-400">
            The stream may not have started yet or your connection dropped.
          </p>
          <button
            onClick={handleRetry}
            className="mt-1 rounded-full bg-amber-400 px-5 py-2 text-sm font-bold text-white hover:bg-amber-500"
          >
            Retry
          </button>
        </div>
      )}

      {/* Controls overlay */}
      {state !== "error" && (
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent px-3 pb-2 pt-8">
          <button
            onClick={toggleMute}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/20"
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
              </svg>
            )}
          </button>

          <button
            onClick={requestFullscreen}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/20"
            aria-label="Fullscreen"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
