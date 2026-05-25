"use client";

/**
 * TheBride — client-side analytics event tracker
 *
 * Usage:
 *   import { trackEvent } from "@/lib/analytics/trackEvent";
 *   trackEvent("post_create", { church_id: "..." });
 *
 * - Safe-fail: any DB/network error is silently swallowed — never blocks UX
 * - Automatically captures: user_id (via Supabase session), route, platform
 * - Never include PII in metadata (no names, emails, message content)
 */

import { supabase } from "../supabase";

export type EventType =
  | "login"
  | "post_create"
  | "post_like"
  | "comment_create"
  | "message_send"
  | "follow_user"
  | "follow_church"
  | "donation_completed"
  | "live_start"
  | "live_join"
  | "support_ticket_created";

export type EventMeta = {
  church_id?: string;
  entity_type?: string;
  entity_id?: string;
  /** Never include PII or message content */
  [key: string]: string | number | boolean | undefined;
};

function getPlatform(): string {
  if (typeof window === "undefined") return "server";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "web";
}

/**
 * Fire-and-forget event tracker.
 * Returns void — never throws, never awaits.
 */
export function trackEvent(
  eventType: EventType,
  meta: EventMeta = {},
): void {
  // Schedule async work without blocking caller
  void (async () => {
    try {
      // Grab session without throwing
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id ?? null;

      const { church_id, entity_type, entity_id, ...rest } = meta;

      await supabase.from("analytics_events").insert({
        user_id:     userId,
        church_id:   church_id ?? null,
        event_type:  eventType,
        entity_type: entity_type ?? null,
        entity_id:   entity_id ?? null,
        route:       typeof window !== "undefined" ? window.location.pathname : null,
        metadata:    Object.keys(rest).length > 0 ? rest : {},
        user_agent:  typeof navigator !== "undefined" ? navigator.userAgent : null,
        platform:    getPlatform(),
      });
    } catch {
      // Silently swallow — analytics must never break the app
    }
  })();
}
