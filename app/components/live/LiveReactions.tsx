"use client";

import { LIVE_REACTION_TYPES } from "../../../lib/types";
import type { FloatingReaction } from "../../../lib/hooks/useLiveReactions";

type LiveReactionsProps = {
  floatingReactions: FloatingReaction[];
  onReact: (type: string) => void;
  disabled?: boolean;
};

export default function LiveReactions({ floatingReactions, onReact, disabled }: LiveReactionsProps) {
  return (
    <>
      {/* Floating reaction animations */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {floatingReactions.map((r) => (
          <div
            key={r.key}
            className="absolute bottom-0 text-2xl"
            style={{
              right: `${r.x}%`,
              animation: "floatUp 2.8s ease-out forwards",
            }}
          >
            {r.reaction_type}
          </div>
        ))}
      </div>

      {/* Reaction bar */}
      <div className="flex items-center justify-center gap-1 py-1.5">
        {LIVE_REACTION_TYPES.map((emoji) => (
          <button
            key={emoji}
            onClick={() => !disabled && onReact(emoji)}
            disabled={disabled}
            className="flex h-10 w-10 items-center justify-center rounded-full text-xl transition hover:scale-125 active:scale-90 disabled:opacity-40"
            aria-label={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </>
  );
}
