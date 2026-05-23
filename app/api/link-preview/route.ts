import { NextRequest, NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// SSRF protection — private / loopback / link-local IPv4 and IPv6 ranges
// ─────────────────────────────────────────────────────────────────────────────
const PRIVATE_IP_PATTERNS: RegExp[] = [
  /^127\./,                                         // IPv4 loopback 127.0.0.0/8
  /^10\./,                                          // RFC1918 10.0.0.0/8
  /^192\.168\./,                                    // RFC1918 192.168.0.0/16
  /^172\.(1[6-9]|2\d|3[01])\./,                    // RFC1918 172.16.0.0/12
  /^169\.254\./,                                    // Link-local 169.254.0.0/16
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,     // Shared address space RFC6598
  /^0\./,                                           // "This" network 0.0.0.0/8
  /^::1$/,                                          // IPv6 loopback
  /^fc[0-9a-f]{2}:/i,                              // IPv6 unique local FC00::/7
  /^fd[0-9a-f]{2}:/i,                              // IPv6 unique local FD00::/8
  /^fe80:/i,                                        // IPv6 link-local
];

const BLOCKED_HOSTNAMES = new Set(["localhost", "0.0.0.0", ""]);

function isSafeHost(hostname: string): boolean {
  // Strip IPv6 brackets
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(h)) return false;
  for (const re of PRIVATE_IP_PATTERNS) {
    if (re.test(h)) return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML entity decoder (handles the most common entities in meta content)
// ─────────────────────────────────────────────────────────────────────────────
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(parseInt(code, 10))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Meta-tag parser (regex-based, no external dependencies)
//
// Handles both attribute orderings:
//   <meta property="og:title" content="..." />
//   <meta content="..." property="og:title" />
// ─────────────────────────────────────────────────────────────────────────────
function getMetaContent(html: string, key: string): string | null {
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // escape regex
  const tries: RegExp[] = [
    // property/name before content — double quotes
    new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]+content="([^"<>]*)"`, "i"),
    // content before property/name — double quotes
    new RegExp(`<meta[^>]+content="([^"<>]*)"[^>]+(?:property|name)=["']${k}["']`, "i"),
    // property/name before content — single quotes
    new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]+content='([^'<>]*)'`, "i"),
    // content before property/name — single quotes
    new RegExp(`<meta[^>]+content='([^'<>]*)'[^>]+(?:property|name)=["']${k}["']`, "i"),
  ];
  for (const re of tries) {
    const m = re.exec(html);
    if (m?.[1]) return decodeEntities(m[1]);
  }
  return null;
}

function getTitleTag(html: string): string | null {
  const m = /<title[^>]*>([^<]{1,500})<\/title>/i.exec(html);
  return m ? decodeEntities(m[1]) : null;
}

function resolveImageUrl(base: string, imageUrl: string): string {
  if (!imageUrl) return imageUrl;
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  try {
    return new URL(imageUrl, base).href;
  } catch {
    return imageUrl;
  }
}

function parseOgMetadata(html: string, baseUrl: string) {
  const title =
    getMetaContent(html, "og:title") ||
    getMetaContent(html, "twitter:title") ||
    getTitleTag(html);

  const description =
    getMetaContent(html, "og:description") ||
    getMetaContent(html, "twitter:description") ||
    getMetaContent(html, "description");

  const rawImage =
    getMetaContent(html, "og:image") ||
    getMetaContent(html, "og:image:url") ||
    getMetaContent(html, "twitter:image") ||
    getMetaContent(html, "twitter:image:src");

  const image = rawImage ? resolveImageUrl(baseUrl, rawImage) : null;
  const siteName = getMetaContent(html, "og:site_name");

  return { title, description, image, siteName };
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // 1. Parse + validate input
  let rawUrl: string;
  try {
    const body = (await req.json()) as { url?: unknown };
    if (typeof body.url !== "string" || !body.url.trim()) {
      return NextResponse.json({ error: "url required" }, { status: 400 });
    }
    rawUrl = body.url.trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 2. Parse URL — normalise bare www. links
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.startsWith("www.") ? `https://${rawUrl}` : rawUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 422 });
  }

  // 3. Scheme check — only http/https
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "Only http/https URLs are supported" }, { status: 422 });
  }

  // 4. SSRF host check — return empty preview without explaining why
  if (!isSafeHost(parsed.hostname)) {
    return NextResponse.json({});
  }

  // 5. Fetch with timeout + response-size cap
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    let response: Response;
    try {
      response = await fetch(parsed.href, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "TheBrideBot/1.0 (+https://thebride.app; link-preview-bot)",
          Accept:
            "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        redirect: "follow",
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      // Non-2xx — return empty preview; never expose status to client
      return NextResponse.json({});
    }

    // Read up to 500 KB — enough to capture the <head> with OG tags
    const MAX_BYTES = 500 * 1024;
    const reader = response.body?.getReader();
    if (!reader) return NextResponse.json({});

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      chunks.push(value);
      if (totalBytes >= MAX_BYTES) {
        await reader.cancel();
        break;
      }
    }

    const decoder = new TextDecoder("utf-8", { fatal: false });
    const html =
      chunks.map((c) => decoder.decode(c, { stream: true })).join("") +
      decoder.decode(); // flush

    // 6. Extract metadata
    const { title, description, image, siteName } = parseOgMetadata(
      html,
      parsed.href
    );
    const domain = parsed.hostname.replace(/^www\./, "");

    // Return only if we have something useful
    if (!title && !description && !image) {
      return NextResponse.json({});
    }

    return NextResponse.json({
      title:       title       ? title.slice(0, 300)       : null,
      description: description ? description.slice(0, 500) : null,
      image:       image       ?? null,
      siteName:    siteName    ?? null,
      domain,
    });
  } catch {
    // Timeout, DNS error, network error — return empty preview silently
    return NextResponse.json({});
  }
}
