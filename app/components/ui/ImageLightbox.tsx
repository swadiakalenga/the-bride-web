"use client";

import { useEffect, useRef } from "react";

type Props = {
  urls: string[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
};

export default function ImageLightbox({ urls, index, onClose, onPrev, onNext }: Props) {
  const touchStartX = useRef<number | null>(null);
  const hasMultiple = urls.length > 1;

  // Keyboard navigation + scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasMultiple) onPrev();
      if (e.key === "ArrowRight" && hasMultiple) onNext();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, onPrev, onNext, hasMultiple]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx < -40 && hasMultiple) onNext();
    else if (dx > 40 && hasMultiple) onPrev();
    touchStartX.current = null;
  };

  return (
    <div
      className="animate-tb-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close */}
      <button
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
        onClick={onClose}
        aria-label="Close"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Counter */}
      {hasMultiple && (
        <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-white">
          {index + 1} / {urls.length}
        </div>
      )}

      {/* Prev */}
      {hasMultiple && (
        <button
          className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          aria-label="Previous image"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}

      {/* Preload adjacent images so swiping is instant */}
      {hasMultiple && urls[index - 1] && <link rel="preload" as="image" href={urls[index - 1]} />}
      {hasMultiple && urls[index + 1] && <link rel="preload" as="image" href={urls[index + 1]} />}

      {/* Image */}
      <img
        src={urls[index]}
        alt={`Image ${index + 1} of ${urls.length}`}
        className="max-h-[90vh] max-w-[90vw] select-none rounded-lg object-contain shadow-2xl animate-tb-fade-in"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
        fetchPriority="high"
      />

      {/* Next */}
      {hasMultiple && (
        <button
          className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          aria-label="Next image"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}

      {/* Dot indicators */}
      {hasMultiple && urls.length <= 10 && (
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-1.5">
          {urls.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); if (i < index) onPrev(); else if (i > index) onNext(); }}
              className={`h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-white" : "w-1.5 bg-white/40"}`}
              aria-label={`Go to image ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
