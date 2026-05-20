/**
 * Client-side image compression using Canvas API.
 * Resizes images wider than maxWidthPx and re-encodes them as JPEG.
 * Skips files that are already small, non-image types, or GIFs (animated).
 * Always resolves (never rejects) — falls back to the original file on error.
 */
export async function compressImage(
  file: File,
  maxWidthPx = 1920,
  qualityJpeg = 0.82,
): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return file;
  }
  // Skip if already under 1 MB and not oversized — no compression needed
  if (file.size <= 1_048_576 && file.name.match(/\.(jpe?g|webp)$/i)) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      if (width <= maxWidthPx && file.size <= 500_000) {
        resolve(file);
        return;
      }

      if (width > maxWidthPx) {
        height = Math.round((height * maxWidthPx) / width);
        width = maxWidthPx;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) { resolve(file); return; }
          const compressed = new File(
            [blob],
            file.name.replace(/\.\w+$/, ".jpg"),
            { type: "image/jpeg", lastModified: Date.now() },
          );
          resolve(compressed);
        },
        "image/jpeg",
        qualityJpeg,
      );
    };

    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });
}
