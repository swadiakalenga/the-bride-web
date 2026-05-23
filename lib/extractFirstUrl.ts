/**
 * Extract the first URL from a block of plain text.
 * Matches http://, https://, and bare www. links.
 * Strips common trailing punctuation that is not part of the URL.
 */
const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<>"']+/;

export function extractFirstUrl(text: string): string | null {
  const match = URL_REGEX.exec(text);
  if (!match) return null;

  // Strip trailing punctuation that is commonly added after URLs in prose
  let raw = match[0].replace(/[.,;!?)"'\]]+$/, "");

  // Normalise bare www. links to https://
  if (raw.startsWith("www.")) {
    raw = `https://${raw}`;
  }

  return raw;
}
