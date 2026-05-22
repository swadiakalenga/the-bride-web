import type { ChatMessage } from "../types";

export function sortMessages(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

export function hasMessage(messages: ChatMessage[], id: string): boolean {
  return messages.some((m) => m.id === id);
}

export function getLatestMessageCursor(messages: ChatMessage[]): string | null {
  const real = messages.filter((m) => !m.pending && !m.failed);
  if (real.length === 0) return null;
  return real[real.length - 1].created_at;
}

export function mergeMessages(
  existing: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] {
  const seen = new Set(existing.map((m) => m.id));
  const novel = incoming.filter((m) => !seen.has(m.id));
  if (novel.length === 0) return existing;
  const merged = sortMessages([...existing, ...novel]);
  console.log(`[message-module] merged count: ${merged.length} (added ${novel.length})`);
  return merged;
}

export function replaceOptimisticMessage(
  existing: ChatMessage[],
  tempId: string,
  saved: ChatMessage,
): ChatMessage[] {
  // If the saved message arrived via realtime before confirm, just drop the temp
  const hasSaved = existing.some((m) => m.id === saved.id);
  if (hasSaved) return existing.filter((m) => m.id !== tempId);
  return existing.map((m) => (m.id === tempId ? saved : m));
}
