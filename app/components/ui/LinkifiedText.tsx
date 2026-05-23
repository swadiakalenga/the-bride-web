"use client";

import React from "react";

// Matches http(s):// or www. URLs (captures the URL as a group so split keeps it)
const URL_PATTERN = /((?:https?:\/\/|www\.)[^\s<>"']+)/g;

/**
 * Splits `text` into alternating plain-string and React <a> nodes.
 * Safe to use inside any element that accepts ReactNode children.
 */
export function linkifyNodes(text: string): React.ReactNode[] {
  const parts = text.split(URL_PATTERN);
  return parts.map((part, i) => {
    if (URL_PATTERN.test(part)) {
      URL_PATTERN.lastIndex = 0; // reset stateful regex after exec
      const href = part.startsWith("www.") ? `https://${part}` : part;
      return (
        <a
          key={i}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-blue-600 underline hover:text-blue-800"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    URL_PATTERN.lastIndex = 0;
    return part;
  });
}

interface LinkifiedTextProps {
  text: string;
  className?: string;
}

/**
 * Renders `text` with any URLs converted to clickable <a> links.
 * Preserves whitespace (whitespace-pre-wrap by default).
 */
export default function LinkifiedText({
  text,
  className = "whitespace-pre-wrap",
}: LinkifiedTextProps) {
  return <span className={className}>{linkifyNodes(text)}</span>;
}
