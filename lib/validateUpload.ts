// MIME type whitelists — never trust the file extension alone
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif",
]);
const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4", "video/webm", "video/ogg", "video/quicktime",
]);
const ALLOWED_AUDIO_TYPES = new Set([
  "audio/mpeg", "audio/mp3", "audio/ogg", "audio/wav", "audio/webm", "audio/aac", "audio/m4a",
]);
const ALLOWED_DOC_TYPES = new Set([
  "application/pdf", "image/jpeg", "image/png", "image/webp",
]);

const MB = 1024 * 1024;

type UploadType = "avatar" | "post_image" | "post_video" | "post_audio" | "message_media" | "verification_doc" | "live_recording";

const LIMITS: Record<UploadType, { maxBytes: number; allowed: Set<string>; label: string }> = {
  avatar:           { maxBytes: 5 * MB,  allowed: ALLOWED_IMAGE_TYPES, label: "Avatar" },
  post_image:       { maxBytes: 10 * MB, allowed: ALLOWED_IMAGE_TYPES, label: "Image" },
  post_video:       { maxBytes: 100 * MB, allowed: ALLOWED_VIDEO_TYPES, label: "Video" },
  post_audio:       { maxBytes: 20 * MB, allowed: ALLOWED_AUDIO_TYPES, label: "Audio" },
  message_media:    { maxBytes: 20 * MB, allowed: new Set([...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES, ...ALLOWED_AUDIO_TYPES]), label: "Media" },
  verification_doc: { maxBytes: 10 * MB, allowed: ALLOWED_DOC_TYPES, label: "Document" },
  live_recording:   { maxBytes: 200 * MB, allowed: ALLOWED_VIDEO_TYPES, label: "Recording" },
};

export type UploadValidationError = { ok: false; message: string };
export type UploadValidationOk = { ok: true };

export function validateUpload(file: File, type: UploadType): UploadValidationOk | UploadValidationError {
  const limit = LIMITS[type];

  if (!limit.allowed.has(file.type)) {
    return {
      ok: false,
      message: `${limit.label}: file type "${file.type || "unknown"}" is not allowed.`,
    };
  }

  if (file.size > limit.maxBytes) {
    const maxMB = (limit.maxBytes / MB).toFixed(0);
    const fileMB = (file.size / MB).toFixed(1);
    return {
      ok: false,
      message: `${limit.label} is too large (${fileMB} MB). Maximum allowed: ${maxMB} MB.`,
    };
  }

  if (file.size === 0) {
    return { ok: false, message: `${limit.label}: file is empty.` };
  }

  return { ok: true };
}
