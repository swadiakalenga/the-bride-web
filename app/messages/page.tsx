"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useLanguage } from "../../lib/useLanguage";

type ConversationRow = {
  id: string;
  other_user_id: string;
  other_user_name: string | null;
  other_user_avatar: string | null;
  last_message: string | null;
  last_message_at: string | null;
  last_sender_is_me: boolean;
  unread_count: number;
  pending?: boolean; // true = sent request waiting for acceptance
};

type MessageRequest = {
  id: string;
  sender_id: string;
  sender_name: string | null;
  sender_avatar: string | null;
  initial_message: string;
  created_at: string;
};

function formatConvTime(dateStr: string | null) {
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

export default function MessagesPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [tab, setTab] = useState<"chats" | "requests">("chats");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [requests, setRequests] = useState<MessageRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  // New conversation
  const [showNewConv, setShowNewConv] = useState(false);
  const [newConvSearch, setNewConvSearch] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; full_name: string | null; avatar_url: string | null }[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    loadPage();

    const onVisible = () => {
      if (document.visibilityState === "visible") loadPage();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  async function loadPage() {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    const me = authData.user?.id;
    if (!me) { router.push("/login"); return; }
    setCurrentUserId(me);
    await Promise.all([loadConversations(me), loadRequests(me)]);
    setLoading(false);
  }

  const loadConversations = async (me: string) => {
    const { data: participations } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", me);

    if (!participations || participations.length === 0) {
      setConversations([]);
      return;
    }

    const convIds = participations.map((p) => p.conversation_id);

    const { data: allParticipants } = await supabase
      .from("conversation_participants")
      .select("conversation_id, user_id")
      .in("conversation_id", convIds)
      .neq("user_id", me);

    if (!allParticipants || allParticipants.length === 0) {
      setConversations([]);
      return;
    }

    const otherUserIds = [...new Set(allParticipants.map((p) => p.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", otherUserIds);

    const profileMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
    (profiles || []).forEach((p) => { profileMap[p.id] = p; });

    const rows: ConversationRow[] = [];

    for (const convId of convIds) {
      const otherParticipant = allParticipants.find((p) => p.conversation_id === convId);
      if (!otherParticipant) continue;

      const profile = profileMap[otherParticipant.user_id] || { full_name: null, avatar_url: null };

      const { data: lastMsgs } = await supabase
        .from("messages")
        .select("content, created_at, is_read, sender_id")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: false })
        .limit(1);

      const last = lastMsgs?.[0] || null;

      const { count: unread } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", convId)
        .eq("is_read", false)
        .neq("sender_id", me);

      rows.push({
        id: convId,
        other_user_id: otherParticipant.user_id,
        other_user_name: profile.full_name,
        other_user_avatar: profile.avatar_url,
        last_message: last?.content || null,
        last_message_at: last?.created_at || null,
        last_sender_is_me: last?.sender_id === me,
        unread_count: unread || 0,
      });
    }

    // Also include message requests I've SENT that are still pending,
    // so the sender sees the conversation even before it's accepted.
    const { data: sentRequests } = await supabase
      .from("message_requests")
      .select("id, recipient_id, initial_message, created_at")
      .eq("sender_id", me)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (sentRequests && sentRequests.length > 0) {
      const recipientIds = [...new Set(sentRequests.map((r) => r.recipient_id))];
      const { data: recipientProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", recipientIds);

      const recipientMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
      (recipientProfiles || []).forEach((p) => { recipientMap[p.id] = p; });

      sentRequests.forEach((req) => {
        const recipient = recipientMap[req.recipient_id] || { full_name: null, avatar_url: null };
        rows.push({
          id: `req-${req.id}`,
          other_user_id: req.recipient_id,
          other_user_name: recipient.full_name,
          other_user_avatar: recipient.avatar_url,
          last_message: req.initial_message,
          last_message_at: req.created_at,
          last_sender_is_me: true,
          unread_count: 0,
          pending: true,
        });
      });
    }

    rows.sort((a, b) => {
      if (!a.last_message_at) return 1;
      if (!b.last_message_at) return -1;
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
    });

    setConversations(rows);
  };

  const loadRequests = async (me: string) => {
    const { data: reqData } = await supabase
      .from("message_requests")
      .select("id, sender_id, initial_message, created_at")
      .eq("recipient_id", me)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (!reqData || reqData.length === 0) { setRequests([]); return; }

    const senderIds = reqData.map((r) => r.sender_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", senderIds);

    const profileMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
    (profiles || []).forEach((p) => { profileMap[p.id] = p; });

    setRequests(reqData.map((r) => ({
      id: r.id,
      sender_id: r.sender_id,
      sender_name: profileMap[r.sender_id]?.full_name || null,
      sender_avatar: profileMap[r.sender_id]?.avatar_url || null,
      initial_message: r.initial_message,
      created_at: r.created_at,
    })));
  };

  const acceptRequest = async (req: MessageRequest) => {
    if (!currentUserId) return;
    setActionLoading(req.id);
    setPageError(null);

    // accept_message_request() is a SECURITY DEFINER function that atomically:
    //   1. Creates the conversation row
    //   2. Inserts both participants (recipient first, then sender)
    //   3. Inserts the initial message with the correct sender_id (bypasses RLS
    //      so the recipient can insert a message attributed to the sender)
    //   4. Marks the message_request as accepted
    //   Returns the new conversation_id.
    //
    // Requires supabase-messaging-fix.sql to be applied in Supabase SQL editor.
    const { data: convId, error } = await supabase
      .rpc("accept_message_request", { p_request_id: req.id });

    if (error || !convId) {
      setActionLoading(null);
      setPageError(
        `Could not accept request: ${error?.message ?? "no conversation returned"}. ` +
        "Make sure supabase-messaging-fix.sql has been applied in the Supabase SQL editor."
      );
      return;
    }

    setActionLoading(null);
    router.push(`/messages/${convId}`);
  };

  const ignoreRequest = async (reqId: string) => {
    setActionLoading(reqId);
    await supabase.from("message_requests").update({ status: "ignored" }).eq("id", reqId);
    setActionLoading(null);
    await loadRequests(currentUserId!);
  };

  const searchUsers = async (q: string) => {
    if (!q.trim() || !currentUserId) { setSearchResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .ilike("full_name", `%${q.trim()}%`)
      .neq("id", currentUserId)
      .limit(10);
    setSearchResults(data || []);
    setSearching(false);
  };

  const startNewConversation = async (targetUser: { id: string; full_name: string | null }) => {
    if (!currentUserId) return;

    // Check if conversation already exists
    const { data: myParts } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", currentUserId);

    if (myParts && myParts.length > 0) {
      const convIds = myParts.map((p) => p.conversation_id);
      const { data: shared } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", targetUser.id)
        .in("conversation_id", convIds)
        .maybeSingle();

      if (shared?.conversation_id) {
        setShowNewConv(false);
        router.push(`/messages/${shared.conversation_id}`);
        return;
      }
    }

    // Use SECURITY DEFINER RPC — no message needed yet, user will type in the chat
    const { data: convId, error: convError } = await supabase
      .rpc("create_direct_conversation", { p_other_user_id: targetUser.id });

    if (convError || !convId) {
      setPageError(`Could not start conversation: ${convError?.message || "unknown error"}`);
      return;
    }

    setShowNewConv(false);
    router.push(`/messages/${convId}`);
  };

  const avatarLetter = (name: string | null) =>
    (name || "U").trim().charAt(0).toUpperCase();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-gray-900">{t("messages_title")}</h1>
        </div>

        {/* New conversation button */}
        <button
          onClick={() => { setShowNewConv(true); setNewConvSearch(""); setSearchResults([]); }}
          className="flex h-9 w-9 items-center justify-center rounded-full text-amber-500 hover:bg-amber-50"
          aria-label="New conversation"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        <button
          type="button"
          onClick={() => setTab("chats")}
          className={`flex-1 py-3 text-sm font-semibold transition-colors ${
            tab === "chats"
              ? "border-b-2 border-amber-400 text-amber-500"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Chats
        </button>
        <button
          type="button"
          onClick={() => setTab("requests")}
          className={`relative flex-1 py-3 text-sm font-semibold transition-colors ${
            tab === "requests"
              ? "border-b-2 border-amber-400 text-amber-500"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Requests
          {requests.length > 0 && (
            <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {requests.length}
            </span>
          )}
        </button>
      </div>

      {/* Inline error banner */}
      {pageError && (
        <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-600">
          {pageError}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "chats" && (
          <>
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <p className="font-semibold text-gray-800">{t("messages_no_conversations")}</p>
                <p className="mt-1 text-sm text-gray-400">{t("messages_no_conversations_desc")}</p>
              </div>
            ) : (
              <div>
                {conversations.map((conv) => {
                  const hasUnread = conv.unread_count > 0;
                  const preview = conv.last_message
                    ? `${conv.last_sender_is_me ? "You: " : ""}${conv.last_message}`
                    : "No messages yet";

                  return (
                    <button
                      key={conv.id}
                      onClick={() => {
                        if (conv.pending) return;
                        router.push(`/messages/${conv.id}`);
                      }}
                      disabled={conv.pending}
                      className={`flex w-full items-center gap-3 px-4 py-3 ${
                        conv.pending ? "cursor-default opacity-70" : "hover:bg-gray-50 active:bg-gray-100"
                      }`}
                    >
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        {conv.other_user_avatar ? (
                          <img
                            src={conv.other_user_avatar}
                            alt=""
                            className="h-14 w-14 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xl font-bold text-white">
                            {avatarLetter(conv.other_user_name)}
                          </div>
                        )}
                        {/* Online dot */}
                        <span className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-500" />
                      </div>

                      {/* Text */}
                      <div className="min-w-0 flex-1 text-left">
                        <p className={`truncate text-[15px] ${hasUnread ? "font-bold text-gray-900" : "font-medium text-gray-800"}`}>
                          {conv.other_user_name || "User"}
                        </p>
                        <p className={`truncate text-sm ${hasUnread ? "font-semibold text-gray-800" : "text-gray-500"}`}>
                          {preview}
                        </p>
                      </div>

                      {/* Right side */}
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <p className={`text-xs ${hasUnread ? "font-semibold text-brand-500" : "text-gray-400"}`}>
                          {formatConvTime(conv.last_message_at)}
                        </p>
                        {conv.pending ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                            Pending
                          </span>
                        ) : hasUnread ? (
                          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-500 px-1.5 text-[11px] font-bold text-white">
                            {conv.unread_count}
                          </span>
                        ) : (
                          <span className="h-5" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === "requests" && (
          <>
            {requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-50">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <p className="font-semibold text-gray-800">No message requests</p>
                <p className="mt-1 text-sm text-gray-400">
                  When someone sends you a message request it will appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {requests.map((req) => (
                  <div key={req.id} className="px-4 py-4">
                    <div className="flex items-start gap-3">
                      {req.sender_avatar ? (
                        <img src={req.sender_avatar} alt="" className="h-12 w-12 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 font-bold text-white">
                          {avatarLetter(req.sender_name)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-900">{req.sender_name || "User"}</p>
                        <p className="mt-0.5 text-sm text-gray-500 line-clamp-2">{req.initial_message}</p>
                        <p className="mt-1 text-xs text-gray-400">{formatConvTime(req.created_at)}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => acceptRequest(req)}
                        disabled={actionLoading === req.id}
                        className="flex-1 rounded-lg bg-amber-400 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:bg-amber-200"
                      >
                        {actionLoading === req.id ? "…" : t("messages_accept")}
                      </button>
                      <button
                        onClick={() => ignoreRequest(req.id)}
                        disabled={actionLoading === req.id}
                        className="flex-1 rounded-lg bg-gray-100 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                      >
                        Ignore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* New conversation modal */}
      {showNewConv && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="w-full max-w-sm rounded-t-2xl bg-white shadow-xl sm:rounded-2xl" style={{ maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <h2 className="font-bold text-gray-900">New Message</h2>
              <button
                onClick={() => setShowNewConv(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
              >
                ✕
              </button>
            </div>

            <div className="px-4 py-3">
              <input
                type="text"
                placeholder="Search people..."
                value={newConvSearch}
                onChange={(e) => {
                  setNewConvSearch(e.target.value);
                  searchUsers(e.target.value);
                }}
                autoFocus
                className="w-full rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm outline-none focus:border-amber-300 focus:bg-white"
              />
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-4">
              {searching && (
                <p className="py-4 text-center text-sm text-gray-400">Searching...</p>
              )}
              {!searching && newConvSearch && searchResults.length === 0 && (
                <p className="py-4 text-center text-sm text-gray-400">No users found.</p>
              )}
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  onClick={() => startNewConversation(user)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-gray-50"
                >
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="h-11 w-11 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 font-bold text-white">
                      {avatarLetter(user.full_name)}
                    </div>
                  )}
                  <span className="font-medium text-gray-900">{user.full_name || "User"}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
