"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { validateUpload } from "../../../lib/validateUpload";
import { useLanguage } from "../../../lib/useLanguage";
import EmojiPicker from "../../components/ui/EmojiPicker";
import ImageLightbox from "../../components/ui/ImageLightbox";
import type { ChatMessage } from "../../../lib/types";

type OtherUser = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

type SidebarConversation = {
  id: string;
  other_user_id: string;
  other_user_name: string | null;
  other_user_avatar: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
};

function formatDateLabel(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = today.getTime() - msgDay.getTime();

  if (diff === 0) return "Today";
  if (diff === 86400000) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatConversationTime(dateStr: string | null) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function isSameDay(a: string, b: string) {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

const mediaErrMsg = {
  uploadFailed: {
    fr: "Échec de l'envoi du fichier. Veuillez réessayer.",
    en: "File upload failed. Please try again.",
  },
  sendFailed: {
    fr: "Impossible d'envoyer le média. Veuillez réessayer.",
    en: "Failed to send media. Please try again.",
  },
};

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const { lang } = useLanguage();
  const conversationId = params.id as string;

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasEarlierMessages, setHasEarlierMessages] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [earliestCreatedAt, setEarliestCreatedAt] = useState<string | null>(null);
  const [sidebarConversations, setSidebarConversations] = useState<SidebarConversation[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [uiMessage, setUiMessage] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMediaMenu, setShowMediaMenu] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightboxUrls, setLightboxUrls] = useState<string[]>([]);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const meRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!conversationId) return;

    // Per-invocation mounted flag. Each navigation/Strict-Mode double-invoke
    // gets its own isolated boolean, so cleanup of an old invocation cannot
    // accidentally un-cancel an in-flight request from a newer one.
    let mounted = true;

    setMessages([]);
    setLoadError(null);
    setOtherUser(null);
    setLoading(true);

    loadPage(() => mounted);

    return () => {
      mounted = false;
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "instant" });
  }, [messages]);

  // Close media menu on outside click
  useEffect(() => {
    if (!showMediaMenu) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-chat-media-menu]")) setShowMediaMenu(false);
    };
    const timer = setTimeout(() => document.addEventListener("click", close), 0);
    return () => { clearTimeout(timer); document.removeEventListener("click", close); };
  }, [showMediaMenu]);

  async function loadPage(isMounted: () => boolean) {
    const convId = conversationId;

    const { data: authData } = await supabase.auth.getUser();
    const me = authData.user?.id;
    if (!me) { router.push("/login"); return; }
    if (!isMounted()) return;

    setCurrentUserId(me);
    meRef.current = me;

    const { data: participation } = await supabase
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", convId)
      .eq("user_id", me)
      .maybeSingle();

    if (!isMounted()) return;

    if (!participation) { router.push("/messages"); return; }

    const { data: others } = await supabase
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", convId)
      .neq("user_id", me);

    if (!isMounted()) return;

    if (others && others.length > 0) {
      const otherId = others[0].user_id;
      const [{ data: profile }, { data: blockRow }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, avatar_url").eq("id", otherId).maybeSingle(),
        supabase.from("user_blocks").select("id").eq("blocker_id", me).eq("blocked_id", otherId).maybeSingle(),
      ]);

      if (isMounted()) {
        setOtherUser({
          id: otherId,
          full_name: profile?.full_name ?? null,
          avatar_url: profile?.avatar_url ?? null,
        });
        setIsBlocked(!!blockRow);
      }
    }

    await Promise.all([loadMessages(me, convId, isMounted), loadSidebarConversations(me)]);
    if (!isMounted()) return;

    subscribeToMessages(me, convId);
    setLoading(false);
  }

  const MSG_PAGE = 50;
  const MSG_COLS = "id, conversation_id, sender_id, content, media_url, media_type, created_at, is_read, read_at";

  const loadMessages = async (me: string, convId: string, isMounted: () => boolean) => {
    // Load latest 50 messages (descending) then reverse for display.
    const { data, error } = await supabase
      .from("messages")
      .select(MSG_COLS)
      .eq("conversation_id", convId)
      .order("created_at", { ascending: false })
      .limit(MSG_PAGE);

    if (!isMounted()) return;

    if (error) {
      setLoadError(`Failed to load messages: ${error.message}`);
      return;
    }
    setLoadError(null);
    const reversed = (data || []).reverse() as ChatMessage[];
    setMessages(reversed);
    setHasEarlierMessages((data || []).length === MSG_PAGE);
    if (reversed.length > 0) setEarliestCreatedAt(reversed[0].created_at);

    supabase
      .from("messages")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("conversation_id", convId)
      .eq("is_read", false)
      .neq("sender_id", me)
      .then(() => {});
  };

  const loadEarlierMessages = async () => {
    if (!earliestCreatedAt || !currentUserId || loadingEarlier) return;
    setLoadingEarlier(true);

    const { data } = await supabase
      .from("messages")
      .select(MSG_COLS)
      .eq("conversation_id", conversationId)
      .lt("created_at", earliestCreatedAt)
      .order("created_at", { ascending: false })
      .limit(MSG_PAGE);

    const earlier = ((data || []).reverse()) as ChatMessage[];
    setMessages((prev) => [...earlier, ...prev]);
    setHasEarlierMessages(earlier.length === MSG_PAGE);
    if (earlier.length > 0) setEarliestCreatedAt(earlier[0].created_at);
    setLoadingEarlier(false);
  };

  const loadSidebarConversations = async (me: string) => {
    // Use the same RPC as messages/page.tsx to eliminate the N+1 loop.
    const { data, error } = await supabase
      .rpc("get_conversation_list", { p_user_id: me });

    if (error || !data) { setSidebarConversations([]); return; }

    type RpcRow = {
      conversation_id: string;
      other_user_id: string;
      other_user_name: string | null;
      other_user_avatar: string | null;
      last_message_content: string | null;
      last_message_at: string | null;
      last_sender_id: string | null;
      unread_count: number;
    };

    setSidebarConversations(
      (data as RpcRow[]).map((row) => ({
        id: row.conversation_id,
        other_user_id: row.other_user_id,
        other_user_name: row.other_user_name,
        other_user_avatar: row.other_user_avatar,
        last_message: row.last_message_content,
        last_message_at: row.last_message_at,
        unread_count: Number(row.unread_count),
      })),
    );
  };

  const subscribeToMessages = (me: string, convId: string) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const channel = supabase
      .channel(`chat-${convId}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${convId}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages((prev) => {
            const optimisticIdx = prev.findIndex(
              (m) => m.pending && m.sender_id === newMsg.sender_id && m.content === newMsg.content
            );
            if (optimisticIdx !== -1) {
              const next = [...prev];
              next[optimisticIdx] = newMsg;
              return next;
            }
            if (prev.find((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          if (newMsg.sender_id !== me) {
            supabase.from("messages")
              .update({ is_read: true, read_at: new Date().toISOString() })
              .eq("id", newMsg.id)
              .then(() => {});
          }
          void loadSidebarConversations(me);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${convId}`,
        },
        (payload) => {
          const updated = payload.new as ChatMessage;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === updated.id
                ? { ...m, is_read: updated.is_read, read_at: updated.read_at }
                : m
            )
          );
          void loadSidebarConversations(me);
        }
      )
      .subscribe();

    channelRef.current = channel;
  };

  const sendMessage = async () => {
    const me = meRef.current;
    if (!me || !input.trim()) return;

    const text = input.trim();
    setInput("");
    setUiMessage("");
    setShowEmojiPicker(false);
    inputRef.current?.focus();

    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      sender_id: me,
      content: text,
      created_at: new Date().toISOString(),
      is_read: false,
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);

    const { error } = await supabase.from("messages").insert([{
      conversation_id: conversationId,
      sender_id: me,
      content: text,
    }]);

    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(text);
      setUiMessage(`Failed to send message: ${error.message}`);
    } else if (otherUser?.id) {
      supabase.from("notifications").insert([{
        recipient_user_id: otherUser.id,
        actor_user_id: me,
        type: "message",
        conversation_id: conversationId,
      }]).then(() => {});
    }
  };

  const sendMediaMessage = async (file: File, type: "image" | "video" | "audio") => {
    const me = meRef.current;
    if (!me) return;

    const r = validateUpload(file, "message_media");
    if (!r.ok) { setUiMessage(r.message); return; }

    setUploading(true);
    setShowMediaMenu(false);

    const ext = file.name.split(".").pop();
    const path = `chat-media/${me}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("media").upload(path, file, {
      contentType: file.type,
    });

    if (uploadError) {
      setUploading(false);
      setUiMessage(mediaErrMsg.uploadFailed[lang]);
      return;
    }

    const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
    const mediaUrl = urlData.publicUrl;

    const caption = type === "image" ? "Sent a photo" : type === "video" ? "Sent a video" : "Sent an audio message";

    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      sender_id: me,
      content: caption,
      media_url: mediaUrl,
      media_type: type,
      created_at: new Date().toISOString(),
      is_read: false,
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);

    const { error } = await supabase.from("messages").insert([{
      conversation_id: conversationId,
      sender_id: me,
      content: caption,
      media_url: mediaUrl,
      media_type: type,
    }]);

    setUploading(false);

    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setUiMessage(mediaErrMsg.sendFailed[lang]);
    } else if (otherUser?.id) {
      supabase.from("notifications").insert([{
        recipient_user_id: otherUser.id,
        actor_user_id: me,
        type: "message",
        conversation_id: conversationId,
      }]).then(() => {});
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const avatarLetter = (name: string | null) => (name || "U").trim().charAt(0).toUpperCase();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
      </div>
    );
  }

  const otherName = otherUser?.full_name || "User";

  const handleBlock = async () => {
    const me = currentUserId;
    const otherId = otherUser?.id;
    if (!me || !otherId) return;
    setBlockLoading(true);
    if (isBlocked) {
      await supabase.from("user_blocks").delete().eq("blocker_id", me).eq("blocked_id", otherId);
      setIsBlocked(false);
    } else {
      await supabase.from("user_blocks").insert([{ blocker_id: me, blocked_id: otherId }]);
      setIsBlocked(true);
    }
    setBlockLoading(false);
    setShowBlockConfirm(false);
  };

  const renderMediaContent = (msg: ChatMessage, isMe: boolean) => {
    if (!msg.media_url || !msg.media_type) return null;

    if (msg.media_type === "image") {
      return (
        <img
          src={msg.media_url}
          alt="Shared photo"
          className="max-w-full rounded-xl object-cover cursor-pointer"
          style={{ maxHeight: "280px" }}
          loading="lazy"
          decoding="async"
          onClick={() => setLightboxUrls([msg.media_url!])}
        />
      );
    }

    if (msg.media_type === "video") {
      return (
        <video
          src={msg.media_url}
          controls
          className="max-w-full rounded-xl bg-black"
          style={{ maxHeight: "280px" }}
          preload="metadata"
        />
      );
    }

    if (msg.media_type === "audio") {
      return (
        <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${isMe ? "bg-brand-400" : "bg-gray-200"}`}>
          <span className="text-lg">🎵</span>
          <audio src={msg.media_url} controls className="h-8 max-w-[200px]" preload="metadata" />
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="hidden w-80 shrink-0 flex-col border-r border-gray-200 bg-white md:flex">
        <div className="border-b border-gray-100 px-4 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Messages</h2>
            <button
              onClick={() => router.push("/messages")}
              className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200"
            >
              Inbox
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sidebarConversations.map((conversation) => {
            const active = conversation.id === conversationId;
            const unread = conversation.unread_count > 0;

            return (
              <button
                key={conversation.id}
                onClick={() => router.push(`/messages/${conversation.id}`)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${active ? "bg-amber-50" : "hover:bg-gray-50"}`}
              >
                {conversation.other_user_avatar ? (
                  <img
                    src={conversation.other_user_avatar}
                    alt=""
                    className="h-11 w-11 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 font-bold text-white">
                    {avatarLetter(conversation.other_user_name)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-sm ${unread ? "font-bold text-gray-900" : "font-semibold text-gray-800"}`}>
                      {conversation.other_user_name || "User"}
                    </p>
                    <span className="shrink-0 text-[11px] text-gray-400">
                      {formatConversationTime(conversation.last_message_at)}
                    </span>
                  </div>
                  <p className={`truncate text-xs ${unread ? "font-semibold text-gray-700" : "text-gray-500"}`}>
                    {conversation.last_message || "No messages yet"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-gray-50">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-3 py-2.5 shadow-sm">
        <button
          onClick={() => router.push("/messages")}
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <button
          onClick={() => otherUser && router.push(`/user/${otherUser.id}`)}
          className="flex flex-1 items-center gap-3"
        >
          {otherUser?.avatar_url ? (
            <img src={otherUser.avatar_url} alt="" className="h-10 w-10 rounded-full border-2 border-amber-200 object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-sm font-bold text-white">
              {avatarLetter(otherUser?.full_name || null)}
            </div>
          )}
          <div className="text-left min-w-0">
            <p className="font-bold text-gray-900 leading-tight truncate">{otherName}</p>
            <p className="text-[11px] text-green-500 font-medium">Active now</p>
          </div>
        </button>

        {/* Call/video placeholders + block */}
        <div className="flex items-center gap-1">
          <button className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92v2z"/>
            </svg>
          </button>
          <button className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
          </button>
          <button
            onClick={() => isBlocked ? handleBlock() : setShowBlockConfirm(true)}
            disabled={blockLoading}
            title={isBlocked
              ? (lang === "fr" ? "Débloquer" : "Unblock")
              : (lang === "fr" ? "Bloquer" : "Block")}
            className={`flex h-9 w-9 items-center justify-center rounded-full transition disabled:opacity-50 ${
              isBlocked ? "text-amber-500 hover:bg-amber-50" : "text-gray-400 hover:bg-red-50 hover:text-red-500"
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Block confirm dialog */}
      {showBlockConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 px-4 pb-8">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <p className="font-semibold text-gray-900">
              {lang === "fr" ? `Bloquer ${otherUser?.full_name ?? "cet utilisateur"} ?` : `Block ${otherUser?.full_name ?? "this user"}?`}
            </p>
            <p className="text-sm text-gray-600">
              {lang === "fr"
                ? "Cette personne ne pourra plus vous envoyer de messages ni voir votre contenu."
                : "This person will no longer be able to message you or see your content."}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBlockConfirm(false)}
                className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                {lang === "fr" ? "Annuler" : "Cancel"}
              </button>
              <button
                onClick={handleBlock}
                disabled={blockLoading}
                className="flex-1 rounded-xl bg-red-500 py-2 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-60"
              >
                {blockLoading ? "…" : (lang === "fr" ? "Bloquer" : "Block")}
              </button>
            </div>
          </div>
        </div>
      )}

      {uiMessage && (
        <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-600">
          {uiMessage}
        </div>
      )}

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-5">

        {/* Load earlier messages */}
        {hasEarlierMessages && (
          <div className="mb-4 flex justify-center">
            <button
              onClick={loadEarlierMessages}
              disabled={loadingEarlier}
              className="rounded-full border border-gray-200 bg-white px-4 py-1.5 text-xs font-semibold text-gray-500 shadow-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {loadingEarlier ? "Loading…" : "Load earlier messages"}
            </button>
          </div>
        )}

        {loadError && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {loadError}
          </div>
        )}
        {!loadError && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            {otherUser?.avatar_url ? (
              <img src={otherUser.avatar_url} alt="" className="h-20 w-20 rounded-full border-4 border-amber-100 object-cover" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-3xl font-bold text-white">
                {avatarLetter(otherUser?.full_name || null)}
              </div>
            )}
            <p className="mt-3 text-lg font-bold text-gray-900">{otherName}</p>
            <p className="mt-1 text-sm text-gray-400">Say hi to start a conversation!</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isMe = msg.sender_id === currentUserId;
          const prev = messages[i - 1];
          const next = messages[i + 1];

          const showDateSeparator = !prev || !isSameDay(prev.created_at, msg.created_at);
          const isFirstInGroup = !prev || prev.sender_id !== msg.sender_id || showDateSeparator;
          const isLastInGroup = !next || next.sender_id !== msg.sender_id || !isSameDay(msg.created_at, next.created_at);

          const hasMedia = !!msg.media_url && !!msg.media_type;

          return (
            <div key={msg.id}>
              {showDateSeparator && (
                <div className="my-6 flex items-center gap-3">
                  <div className="flex-1 border-t border-gray-200" />
                  <span className="rounded-full bg-gray-100 px-3 py-0.5 text-[11px] font-medium text-gray-400">{formatDateLabel(msg.created_at)}</span>
                  <div className="flex-1 border-t border-gray-200" />
                </div>
              )}

              <div className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : "flex-row"} ${isLastInGroup ? "mb-4" : "mb-1"}`}>
                {!isMe && (
                  <div className="w-8 flex-shrink-0">
                    {isLastInGroup && (
                      otherUser?.avatar_url ? (
                        <img src={otherUser.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-xs font-bold text-white">
                          {avatarLetter(otherUser?.full_name || null)}
                        </div>
                      )
                    )}
                  </div>
                )}

                <div className={`flex max-w-[75%] flex-col ${isMe ? "items-end" : "items-start"}`}>
                  {/* Media content */}
                  {hasMedia && (
                    <div className={`mb-1 overflow-hidden rounded-2xl ${msg.pending ? "opacity-60" : ""}`}>
                      {renderMediaContent(msg, isMe)}
                    </div>
                  )}

                  {/* Text bubble (skip if media-only with auto caption) */}
                  {(!hasMedia || (msg.content && !["Sent a photo", "Sent a video", "Sent an audio message"].includes(msg.content))) && (
                    <div
                      className={`break-words px-4 py-2.5 text-sm leading-relaxed ${
                        isMe ? "bg-amber-400 text-white" : "bg-gray-100 text-gray-900"
                      } ${
                        isMe
                          ? isFirstInGroup && isLastInGroup ? "rounded-[20px]"
                            : isFirstInGroup ? "rounded-[20px] rounded-br-md"
                            : isLastInGroup ? "rounded-[20px] rounded-tr-md"
                            : "rounded-[20px] rounded-r-md"
                          : isFirstInGroup && isLastInGroup ? "rounded-[20px]"
                            : isFirstInGroup ? "rounded-[20px] rounded-bl-md"
                            : isLastInGroup ? "rounded-[20px] rounded-tl-md"
                            : "rounded-[20px] rounded-l-md"
                      } ${msg.pending ? "opacity-60" : "opacity-100"}`}
                    >
                      {msg.content}
                    </div>
                  )}

                  {isLastInGroup && (
                    <div className={`mt-1 flex items-center gap-1 text-[10px] text-gray-400 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                      <span>{formatTime(msg.created_at)}</span>
                      {isMe && !msg.pending && (
                        <span className={(msg.read_at ?? msg.is_read) ? "text-amber-500" : "text-gray-400"}>
                          {(msg.read_at ?? msg.is_read) ? "✓✓" : "✓"}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
        </div>
      </div>

      {/* Upload indicator */}
      {uploading && (
        <div className="flex items-center gap-2 border-t border-gray-100 bg-amber-50 px-4 py-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          <span className="text-xs text-amber-700 font-medium">Uploading media...</span>
        </div>
      )}

      {/* ── Hidden file inputs ── */}
      <div className="fixed -left-[9999px] -top-[9999px] opacity-0 pointer-events-none" aria-hidden="true">
        <input ref={mediaInputRef} type="file" accept="image/*" tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) sendMediaMessage(f, "image");
            e.target.value = "";
          }}
        />
        <input ref={audioInputRef} type="file" accept="audio/*" tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) sendMediaMessage(f, "audio");
            e.target.value = "";
          }}
        />
        <input ref={videoInputRef} type="file" accept="video/*" tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) sendMediaMessage(f, "video");
            e.target.value = "";
          }}
        />
      </div>

      {/* ── Input bar ── */}
      <div className="border-t border-gray-200 bg-white pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-3">
          {/* Media attachment button */}
          <div className="relative" data-chat-media-menu>
            <button
              onClick={() => { setShowMediaMenu((v) => !v); setShowEmojiPicker(false); }}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-amber-500 hover:bg-amber-50"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </button>

            {showMediaMenu && (
              <div className="absolute bottom-12 left-0 z-50 flex flex-col gap-0.5 rounded-2xl border border-gray-100 bg-white p-1.5 shadow-xl min-w-[140px]">
                <button
                  onClick={() => { setShowMediaMenu(false); setTimeout(() => mediaInputRef.current?.click(), 10); }}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <span className="text-lg">📷</span> Photo
                </button>
                <button
                  onClick={() => { setShowMediaMenu(false); setTimeout(() => videoInputRef.current?.click(), 10); }}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <span className="text-lg">🎥</span> Video
                </button>
                <button
                  onClick={() => { setShowMediaMenu(false); setTimeout(() => audioInputRef.current?.click(), 10); }}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <span className="text-lg">🎵</span> Audio
                </button>
              </div>
            )}
          </div>

          {/* Text input */}
          <div className="flex flex-1 items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
            />
          </div>

          {/* Emoji button */}
          <div className="relative">
            <button
              onClick={() => { setShowEmojiPicker((v) => !v); setShowMediaMenu(false); }}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
            >
              <span className="text-xl">😊</span>
            </button>
            {showEmojiPicker && (
              <div className="absolute bottom-12 right-0 z-50">
                <EmojiPicker
                  onSelect={(emoji) => setInput((prev) => prev + emoji)}
                  onClose={() => setShowEmojiPicker(false)}
                />
              </div>
            )}
          </div>

          {/* Send button */}
          <button
            onClick={sendMessage}
            disabled={!input.trim() || uploading}
            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-all ${
              input.trim()
                ? "bg-amber-400 text-white shadow-sm active:scale-95"
                : "text-gray-300"
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
      </div>

      {lightboxUrls.length > 0 && (
        <ImageLightbox
          urls={lightboxUrls}
          index={0}
          onClose={() => setLightboxUrls([])}
          onPrev={() => {}}
          onNext={() => {}}
        />
      )}
    </div>
  );
}
