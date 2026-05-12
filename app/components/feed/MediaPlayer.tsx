"use client";

import { useRef, useState, useEffect } from "react";

type MediaPlayerProps = {
  url: string;
  type: "audio" | "video";
};

export default function MediaPlayer({ url, type }: MediaPlayerProps) {
  if (type === "audio") {
    return <AudioPlayer url={url} />;
  }

  return (
    <div className="mt-3 overflow-hidden rounded-xl border bg-black">
      <video
        controls
        className="w-full max-h-96 object-contain"
        src={url}
        preload="metadata"
      />
    </div>
  );
}

function AudioPlayer({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoaded = () => setDuration(audio.duration || 0);
    const onTime = () => setCurrent(audio.currentTime);
    const onEnded = () => setPlaying(false);

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
    setPlaying(!playing);
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const bar = progressRef.current;
    if (!audio || !bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
  };

  const fmt = (s: number) => {
    if (!s || !isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="mt-3 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 p-4">
      <audio ref={audioRef} src={url} preload="metadata" />

      <div className="flex items-center gap-3">
        {/* Play/Pause button */}
        <button
          onClick={toggle}
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-amber-400 text-white shadow-sm hover:bg-amber-500 active:scale-95 transition"
        >
          {playing ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5.14v14.72a1 1 0 001.5.86l11-7.36a1 1 0 000-1.72l-11-7.36A1 1 0 008 5.14z" />
            </svg>
          )}
        </button>

        {/* Waveform / progress area */}
        <div className="flex-1 min-w-0">
          {/* Progress bar */}
          <div
            ref={progressRef}
            onClick={seek}
            className="group relative h-8 flex items-center cursor-pointer"
          >
            {/* Waveform bars (decorative) */}
            <div className="absolute inset-0 flex items-center gap-[2px] px-0.5">
              {Array.from({ length: 40 }).map((_, i) => {
                const heights = [40, 65, 30, 80, 55, 90, 45, 70, 35, 85, 50, 75, 60, 95, 40, 70, 55, 85, 45, 65, 80, 50, 90, 35, 75, 60, 45, 85, 70, 55, 40, 90, 65, 50, 80, 35, 75, 60, 85, 45];
                const h = heights[i % heights.length];
                const filled = (i / 40) * 100 < progress;
                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-full transition-colors duration-150 ${
                      filled ? "bg-amber-400" : "bg-amber-200/60"
                    }`}
                    style={{ height: `${h}%` }}
                  />
                );
              })}
            </div>
          </div>

          {/* Time display */}
          <div className="flex justify-between mt-0.5 px-0.5">
            <span className="text-[11px] font-medium text-amber-600/70">{fmt(currentTime)}</span>
            <span className="text-[11px] font-medium text-amber-600/70">{fmt(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
