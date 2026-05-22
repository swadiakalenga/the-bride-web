"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";
import type { LiveChatMessage } from "../types";

const CHAT_COLS =
  "id, live_event_id, user_id, message, created_at, profiles(full_name, avatar_url)";
const CHAT_LIMIT = 100;
const POLL_MS = 5000;

function normaliseRow(row: Record<string, unknown>): LiveChatMessage {
  const profile = row.profiles as { full_name?: string | null; avatar_url?: string | null } | null;
  return {
    id: row.id as string,
    live_event_id: row.live_event_id as string,
    user_id: row.user_id as string,
    message: row.message as string,
    created_at: row.created_at as string,
    author_name: profile?.full_name ?? null,
    author_avatar: profile?.avatar_url ?? null,
  };
}

function mergeChat(existing: LiveChatMessage[], incoming: LiveChatMessage[]): LiveChatMessage[] {
  const seen = new Set(existing.map((m) => m.id));
  const novel = incoming.filter((m) => !seen.has(m.id));
  if (novel.length === 0) return existing;
  return [...existing, ...novel].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

export function useLiveChat(liveEventId: string, userId: string | null) {
  const [messages, setMessages]   = useState<LiveChatMessage[]>([]);
  const [sending, setSending]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const channelRef                = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const cursorRef                 = useRef<string | null>(null);
  const pollingRef                = useRef(false);

  // ── Initial load ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!liveEventId) return;
    let mounted = true;

    (async () => {
      const { data, error: err } = await supabase
        .from("church_live_chat_messages")
        .select(CHAT_COLS)
        .eq("live_event_id", liveEventId)
        .order("created_at", { ascending: false })
        .limit(CHAT_LIMIT);

      if (!mounted) return;
      if (err) { setError("Failed to load chat"); return; }

      const msgs = ((data ?? []).reverse()).map(normaliseRow);
      setMessages(msgs);
      if (msgs.length > 0) cursorRef.current = msgs[msgs.length - 1].created_at;
    })();

    return () => { mounted = false; };
  }, [liveEventId]);

  // ── Realtime subscription ─────────────────────────────────────────────────

  useEffect(() => {
    if (!liveEventId) return;

    const sub = async () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);

      const channel = supabase
        .channel(`live-chat-${liveEventId}-${Date.now()}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "church_live_chat_messages",
            filter: `live_event_id=eq.${liveEventId}`,
          },
          async (payload) => {
            // Fetch the full row (with profile join) since postgres_changes doesn't support joins
            const { data } = await supabase
              .from("church_live_chat_messages")
              .select(CHAT_COLS)
              .eq("id", payload.new.id)
              .maybeSingle();

            if (!data) return;
            const msg = normaliseRow(data as Record<string, unknown>);

            setMessages((prev) => {
              // Replace matching optimistic message
              const optIdx = prev.findIndex(
                (m) => m.pending && m.user_id === msg.user_id && m.message === msg.message,
              );
              if (optIdx !== -1) {
                const next = [...prev];
                next[optIdx] = msg;
                cursorRef.current = msg.created_at;
                return next;
              }
              const merged = mergeChat(prev, [msg]);
              cursorRef.current = merged[merged.length - 1]?.created_at ?? cursorRef.current;
              return merged;
            });
          },
        )
        .subscribe();

      channelRef.current = channel;
    };

    void sub();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") void sub();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [liveEventId]);

  // ── Polling fallback ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!liveEventId) return;

    const tick = async () => {
      if (document.hidden || pollingRef.current) return;
      const cursor = cursorRef.current;
      if (!cursor) return;

      pollingRef.current = true;
      try {
        const { data } = await supabase
          .from("church_live_chat_messages")
          .select(CHAT_COLS)
          .eq("live_event_id", liveEventId)
          .gt("created_at", cursor)
          .order("created_at", { ascending: true });

        if (data && data.length > 0) {
          const fresh = data.map(normaliseRow);
          setMessages((prev) => {
            const merged = mergeChat(prev, fresh);
            cursorRef.current = merged[merged.length - 1]?.created_at ?? cursor;
            return merged;
          });
        }
      } catch { /* silent */ } finally {
        pollingRef.current = false;
      }
    };

    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, [liveEventId]);

  // ── Send ──────────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string): Promise<boolean> => {
    if (!userId || !text.trim() || sending) return false;
    setSending(true);
    setError(null);

    const tempId = `temp-${Date.now()}`;
    const optimistic: LiveChatMessage = {
      id: tempId,
      live_event_id: liveEventId,
      user_id: userId,
      message: text.trim(),
      created_at: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);

    const { error: err } = await supabase.from("church_live_chat_messages").insert([{
      live_event_id: liveEventId,
      user_id: userId,
      message: text.trim(),
    }]);

    setSending(false);

    if (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setError("Failed to send message");
      return false;
    }
    return true;
  }, [liveEventId, userId, sending]);

  return { messages, sending, error, sendMessage };
}
