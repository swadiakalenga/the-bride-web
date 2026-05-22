"use client";

import { useEffect, useRef, useState } from "react";
import type { LiveChatMessage } from "../../../lib/types";

type LiveChatProps = {
  messages: LiveChatMessage[];
  sending: boolean;
  currentUserId: string | null;
  onSend: (text: string) => Promise<boolean>;
  className?: string;
};

function formatChatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function avatarLetter(name: string | null | undefined) {
  return (name || "?").trim().charAt(0).toUpperCase();
}

export default function LiveChat({
  messages,
  sending,
  currentUserId,
  onSend,
  className = "",
}: LiveChatProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef(true);

  // Auto-scroll only when near bottom
  useEffect(() => {
    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    await onSend(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); }
  };

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5">
        <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-xs font-bold uppercase tracking-wider text-white">Live Chat</span>
      </div>

      {/* Messages */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-2"
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.15) transparent" }}
      >
        {messages.length === 0 && (
          <p className="pt-8 text-center text-xs text-white/40">
            Chat will appear here as people join
          </p>
        )}
        {messages.map((msg) => {
          const isMe = msg.user_id === currentUserId;
          return (
            <div key={msg.id} className={`flex items-start gap-2 ${msg.pending ? "opacity-60" : ""}`}>
              {msg.author_avatar ? (
                <img
                  src={msg.author_avatar}
                  alt=""
                  className="mt-0.5 h-6 w-6 flex-shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                  {avatarLetter(msg.author_name)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <span className={`text-[11px] font-semibold ${isMe ? "text-amber-400" : "text-white/70"}`}>
                  {msg.author_name || "User"}
                </span>
                <span className="ml-1.5 text-[10px] text-white/30">{formatChatTime(msg.created_at)}</span>
                <p className="break-words text-xs leading-relaxed text-white/90">{msg.message}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {currentUserId ? (
        <div className="border-t border-white/10 p-2">
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={500}
              placeholder="Say something..."
              className="flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/40"
            />
            <button
              onClick={() => void handleSend()}
              disabled={!input.trim() || sending}
              className={`flex h-7 w-7 items-center justify-center rounded-full transition ${
                input.trim() && !sending
                  ? "bg-amber-400 text-white"
                  : "text-white/30"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        <div className="border-t border-white/10 p-3">
          <p className="text-center text-xs text-white/40">Sign in to join the chat</p>
        </div>
      )}
    </div>
  );
}
