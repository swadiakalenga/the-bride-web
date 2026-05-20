/**
 * Client-side image compression using the Canvas API.
 *
 * - Resizes images wider than maxWidthPx (default 1600px).
 * - Re-encodes as JPEG at the given quality (default 0.78).
 * - Skips GIFs (animated support would be lost) and non-image files.
 * - Skips files already small enough to avoid unnecessary re-encoding.
 * - Always resolves — never rejects.  Falls back to the original file on error.
 * - Rejects files over maxSizeMb (default 20 MB) before any processing.
 *
 * Differences from compressImage.ts:
 *   • Slightly lower default quality (0.78 vs 0.82) for smaller uploads.
 *   • Lower default max width (1600 vs 1920) — sufficient for social feeds.
 *   • Explicit maxSizeMb guard with clear user-facing rejection.
 *   • Returns { file, rejected, reason } so callers can surface errors.
 */

export type CompressionResult =
  | { file: File; rejected: false }
  | { file: null; rejected: true; reason: string };

export async function compressImageForUpload(
  file: File,
  maxWidthPx = 1600,
  qualityJpeg = 0.78,
  maxSizeMb = 20,
): Promise<CompressionResult> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return { file, rejected: false };
  }

  if (file.size > maxSizeMb * 1_048_576) {
    return {
      file: null,
      rejected: true,
      reason: `Image is too large (max ${maxSizeMb} MB).`,
    };
  }

  // Already small enough — no re-encoding needed
  if (file.size <= 300_000 && file.name.match(/\.(jpe?g|webp)$/i)) {
    return { file, rejected: false };
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // Already within size and dimension limits — skip re-encoding
      if (width <= maxWidthPx && file.size <= 400_000) {
        resolve({ file, rejected: false });
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
      if (!ctx) {
        resolve({ file, rejected: false });
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            resolve({ file, rejected: false });
            return;
          }
          const compressed = new File(
            [blob],
            file.name.replace(/\.\w+$/, ".jpg"),
            { type: "image/jpeg", lastModified: Date.now() },
          );
          resolve({ file: compressed, rejected: false });
        },
        "image/jpeg",
        qualityJpeg,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ file, rejected: false });
    };

    img.src = objectUrl;
  });
}

/**
 * Batch-compress an array of image files.
 * Rejected files are filtered out; a summary of rejections is returned.
 */
export async function compressBatch(
  files: File[],
  maxWidthPx = 1600,
  qualityJpeg = 0.78,
  maxSizeMb = 20,
): Promise<{ files: File[]; rejectedCount: number; rejectedReasons: string[] }> {
  const results = await Promise.all(
    files.map((f) => compressImageForUpload(f, maxWidthPx, qualityJpeg, maxSizeMb)),
  );

  const accepted: File[] = [];
  const reasons: string[] = [];

  results.forEach((r) => {
    if (r.rejected) {
      reasons.push(r.reason);
    } else if (r.file) {
      accepted.push(r.file);
    }
  });

  return { files: accepted, rejectedCount: reasons.length, rejectedReasons: reasons };
}
