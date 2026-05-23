"use client";

import { useState } from "react";
import { linkifyNodes } from "./LinkifiedText";

type ExpandableTextProps = {
  text: string;
  limit?: number;
  lang?: "fr" | "en";
  className?: string;
};

export default function ExpandableText({
  text,
  limit = 280,
  lang = "en",
  className = "mt-1 whitespace-pre-wrap text-sm leading-relaxed",
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);

  if (!text || text.length <= limit) {
    return <p className={className}>{linkifyNodes(text)}</p>;
  }

  const seeMore = lang === "fr" ? "Voir plus…" : "See more…";
  const seeLess = lang === "fr" ? "Voir moins" : "See less";

  return (
    <p className={className}>
      {expanded ? linkifyNodes(text) : linkifyNodes(text.slice(0, limit).trimEnd() + "…")}
      {" "}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="inline font-medium text-brand-600 hover:text-brand-700 focus:outline-none"
      >
        {expanded ? seeLess : seeMore}
      </button>
    </p>
  );
}
