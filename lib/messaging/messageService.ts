import { supabase } from "../supabase";
import type { ChatMessage } from "../types";

const MSG_COLS =
  "id, conversation_id, sender_id, content, media_url, media_type, created_at, is_read, read_at, is_edited, edited_at";

export async function loadLatestMessages(
  conversationId: string,
  limit = 50,
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(MSG_COLS)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[message-module] loadLatestMessages error", error.message);
    throw error;
  }

  const msgs = ((data ?? []).reverse()) as ChatMessage[];
  return msgs;
}

export async function loadOlderMessages(
  conversationId: string,
  beforeCreatedAt: string,
  limit = 50,
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(MSG_COLS)
    .eq("conversation_id", conversationId)
    .lt("created_at", beforeCreatedAt)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[message-module] loadOlderMessages error", error.message);
    throw error;
  }

  return ((data ?? []).reverse()) as ChatMessage[];
}

export async function loadNewMessagesSince(
  conversationId: string,
  afterCreatedAt: string,
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(MSG_COLS)
    .eq("conversation_id", conversationId)
    .gt("created_at", afterCreatedAt)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[message-module] loadNewMessagesSince error", error.message);
    throw error;
  }

  return (data ?? []) as ChatMessage[];
}

export type SendMessageParams = {
  conversationId: string;
  senderId: string;
  content: string;
  mediaUrl?: string;
  mediaType?: string;
};

export async function sendMessage(params: SendMessageParams): Promise<ChatMessage> {
  const { conversationId, senderId, content, mediaUrl, mediaType } = params;

  const row: Record<string, string> = {
    conversation_id: conversationId,
    sender_id: senderId,
    content,
  };
  if (mediaUrl)  row.media_url  = mediaUrl;
  if (mediaType) row.media_type = mediaType;

  const { data, error } = await supabase
    .from("messages")
    .insert([row])
    .select(MSG_COLS)
    .single();

  if (error) {
    console.error("[message-module] sendMessage error", error.message);
    throw error;
  }

  return data as ChatMessage;
}

export async function editMessage(
  messageId: string,
  newContent: string,
): Promise<void> {
  const { error } = await supabase
    .from("messages")
    .update({
      content:   newContent,
      is_edited: true,
      edited_at: new Date().toISOString(),
    })
    .eq("id", messageId);

  if (error) {
    console.error("[message-module] editMessage error", error.message);
    throw error;
  }
}

export async function deleteMessage(messageId: string): Promise<void> {
  const { error } = await supabase
    .from("messages")
    .delete()
    .eq("id", messageId);

  if (error) {
    console.error("[message-module] deleteMessage error", error.message);
    throw error;
  }
}

export async function markConversationRead(
  conversationId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("messages")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("is_read", false)
    .neq("sender_id", userId);

  if (error) {
    console.error("[message-module] markConversationRead error", error.message);
  }
}
