"use client";

import { useState } from "react";
import ImageLightbox from "../ui/ImageLightbox";

type MediaGridProps = {
  urls: string[];
};

export default function MediaGrid({ urls }: MediaGridProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!urls || urls.length === 0) return null;

  const open = (i: number) => setLightboxIndex(i);
  const close = () => setLightboxIndex(null);
  const prev = () => setLightboxIndex((cur) => (cur !== null ? (cur - 1 + urls.length) % urls.length : 0));
  const next = () => setLightboxIndex((cur) => (cur !== null ? (cur + 1) % urls.length : 0));

  const imgClass = "cursor-pointer object-cover transition-opacity hover:opacity-90 active:opacity-75 select-none max-w-full";

  return (
    <>
      {urls.length === 1 && (
        <button
          type="button"
          className="mt-3 block w-full max-w-full overflow-hidden rounded-lg text-left"
          onClick={() => open(0)}
          aria-label="View image"
        >
          <img
            src={urls[0]}
            alt="Post image"
            className={`w-full max-w-full rounded-lg border ${imgClass}`}
            loading="lazy"
            decoding="async"
          />
        </button>
      )}

      {urls.length === 2 && (
        <div className="mt-3 grid grid-cols-2 gap-1 overflow-hidden rounded-lg border">
          {urls.map((url, i) => (
            <button key={i} type="button" onClick={() => open(i)} aria-label={`View image ${i + 1}`}>
              <img
                src={url}
                alt={`Post image ${i + 1}`}
                className={`aspect-square w-full ${imgClass}`}
                loading="lazy"
                decoding="async"
              />
            </button>
          ))}
        </div>
      )}

      {urls.length === 3 && (
        <div className="mt-3 grid grid-cols-2 gap-1 overflow-hidden rounded-lg border">
          <button type="button" onClick={() => open(0)} aria-label="View image 1" className="row-span-2">
            <img
              src={urls[0]}
              alt="Post image 1"
              className={`h-full w-full ${imgClass}`}
              style={{ minHeight: "200px" }}
            />
          </button>
          {urls.slice(1).map((url, i) => (
            <button key={i + 1} type="button" onClick={() => open(i + 1)} aria-label={`View image ${i + 2}`}>
              <img
                src={url}
                alt={`Post image ${i + 2}`}
                className={`aspect-square w-full ${imgClass}`}
              />
            </button>
          ))}
        </div>
      )}

      {urls.length >= 4 && (
        <div className="mt-3 grid grid-cols-2 gap-1 overflow-hidden rounded-lg border">
          {urls.slice(0, 4).map((url, i) => {
            const extra = urls.length - 4;
            return (
              <button key={i} type="button" onClick={() => open(i)} aria-label={`View image ${i + 1}`} className="relative">
                <img
                  src={url}
                  alt={`Post image ${i + 1}`}
                  className={`aspect-square w-full ${imgClass}`}
                />
                {i === 3 && extra > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none">
                    <span className="text-2xl font-bold text-white">+{extra}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {lightboxIndex !== null && (
        <ImageLightbox
          urls={urls}
          index={lightboxIndex}
          onClose={close}
          onPrev={prev}
          onNext={next}
        />
      )}
    </>
  );
}
