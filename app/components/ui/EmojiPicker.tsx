"use client";

import { useState } from "react";

const EMOJI_CATEGORIES: Record<string, string[]> = {
  "Faith": ["🙏", "✝️", "⛪", "📖", "🕊️", "👼", "🌟", "💒", "🔔", "🕯️", "❤️‍🔥", "🫶", "🤲", "✨", "🌈"],
  "Smileys": ["😀", "😊", "😇", "🥰", "😍", "🤗", "😂", "🥹", "😌", "🙂", "😎", "🤩", "😘", "😋", "🫡"],
  "Love": ["❤️", "🧡", "💛", "💚", "💙", "💜", "🩷", "🖤", "💕", "💖", "💗", "💝", "💘", "🫀", "💑"],
  "Hands": ["👏", "🤝", "🙌", "👐", "✋", "🤚", "👋", "🫱", "🫲", "👍", "👎", "✊", "🤞", "🫰", "☝️"],
  "Nature": ["🌸", "🌺", "🌻", "🌹", "🌷", "🌼", "🌿", "🍃", "🌳", "⭐", "🌙", "☀️", "🌊", "🔥", "🦋"],
  "Symbols": ["💯", "🎉", "🎊", "🎵", "🎶", "💬", "💭", "🗣️", "👁️", "🫂", "🙋", "💪", "🦅", "🐑", "🐟"],
};

type EmojiPickerProps = {
  onSelect: (emoji: string) => void;
  onClose: () => void;
};

export default function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState("Faith");
  const categories = Object.keys(EMOJI_CATEGORIES);

  return (
    <div className="absolute bottom-12 left-0 z-50 w-72 rounded-2xl border border-gray-200 bg-white shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
        <span className="text-xs font-semibold text-gray-500">Emoji</span>
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          ✕
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-gray-50 px-2 py-1.5" style={{ scrollbarWidth: "none" }}>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
              activeCategory === cat
                ? "bg-amber-100 text-amber-700"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Emoji grid */}
      <div className="grid grid-cols-8 gap-0.5 p-2" style={{ maxHeight: "160px", overflowY: "auto" }}>
        {EMOJI_CATEGORIES[activeCategory]?.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onSelect(emoji)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-xl transition hover:bg-gray-100 active:scale-90"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
