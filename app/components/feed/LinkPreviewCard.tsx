"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LinkPreviewCard
//
// Renders a rich-link preview card beneath post text.
// All data comes from the server-side /api/link-preview route (stored on the
// post row), so there is no client-side fetch here.
//
// Usage:
//   <LinkPreviewCard url={post.link_url} title={post.link_title} ... />
// ─────────────────────────────────────────────────────────────────────────────

type LinkPreviewCardProps = {
  url: string;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  siteName?: string | null;
  domain?: string | null;
};

export default function LinkPreviewCard({
  url,
  title,
  description,
  image,
  siteName,
  domain,
}: LinkPreviewCardProps) {
  // Derive a display domain from props or the URL itself as fallback
  const displayDomain =
    domain ||
    siteName ||
    (() => {
      try {
        return new URL(url).hostname.replace(/^www\./, "");
      } catch {
        return url;
      }
    })();

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="mt-2.5 block w-full max-w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50 transition hover:bg-gray-100 active:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
    >
      {/* OG image */}
      {image && (
        <div className="overflow-hidden">
          <img
            src={image}
            alt={title ?? ""}
            loading="lazy"
            className="h-44 w-full object-cover"
            onError={(e) => {
              // Hide broken images gracefully
              (e.currentTarget as HTMLImageElement).parentElement!.style.display = "none";
            }}
          />
        </div>
      )}

      {/* Text area */}
      <div className="px-3.5 py-2.5">
        {/* Domain / site name */}
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
          {displayDomain}
        </p>

        {/* Title */}
        {title && (
          <p className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug text-gray-900">
            {title}
          </p>
        )}

        {/* Description */}
        {description && (
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-gray-500">
            {description}
          </p>
        )}
      </div>
    </a>
  );
}
