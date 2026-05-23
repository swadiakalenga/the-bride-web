export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  church_id: string | null;
};

export type Post = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  church_id: string | null;
  author_name: string | null;
  media_urls: string[] | null;
  media_type: string | null;
  tagged_user_ids?: string[];
};

export type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  parent_comment_id: string | null;
  author_name: string | null;
  content: string;
  created_at: string;
};

export type ChatMessage = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
  read_at?: string | null;
  media_url?: string | null;
  media_type?: string | null; // 'image' | 'video' | 'audio'
  is_edited?: boolean;
  edited_at?: string | null;
  pending?: boolean;
  failed?: boolean;
};

export type LiveEventStatus = "scheduled" | "live" | "ended" | "cancelled";

export type LiveEvent = {
  id: string;
  church_id: string;
  created_by: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  scheduled_for: string | null;
  started_at: string | null;
  ended_at: string | null;
  status: LiveEventStatus;
  stream_input_id: string | null;
  playback_url: string | null;
  hls_url: string | null;
  viewer_count: number;
  replay_enabled: boolean;
  created_at: string;
  // Mux-specific fields (added by migration supabase-mux-live-automation.sql)
  stream_key?: string | null;
  provider?: string | null;
  playback_id?: string | null;
  // joined from churches
  church_name?: string | null;
  church_avatar?: string | null;
};

export type LiveChatMessage = {
  id: string;
  live_event_id: string;
  user_id: string;
  message: string;
  created_at: string;
  // joined from profiles
  author_name?: string | null;
  author_avatar?: string | null;
  pending?: boolean;
};

export type LiveReaction = {
  id: string;
  live_event_id: string;
  user_id: string;
  reaction_type: string;
  created_at: string;
};

export const LIVE_REACTION_TYPES = ["🙏", "❤️", "🔥", "✝️", "👏", "🙌", "⭐", "😭"] as const;

export type NotificationType =
  | "follow"
  | "like"
  | "comment"
  | "reply"
  | "membership_request"
  | "membership_approved"
  | "membership_rejected"
  | "church_verified"
  | "church_rejected"
  | "message"
  | "message_request"
  | "tag"
  | "prayer"
  | "event"
  | "church_live_started"
  | "church_live_scheduled";

export type NotificationItem = {
  id: string;
  type: NotificationType;
  created_at: string;
  is_read: boolean;
  post_id: string | null;
  comment_id: string | null;
  conversation_id: string | null;
  church_id: string | null;
  actor_user_id: string;
  actor?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
};

export type ChurchEvent = {
  id: string;
  church_id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  created_by: string | null;
  created_at: string;
};

export type RsvpStatus = "going" | "interested" | "not_going";

export type EventRsvp = {
  id: string;
  event_id: string;
  user_id: string;
  status: RsvpStatus;
  created_at: string;
};

export type ChurchEventWithRsvp = ChurchEvent & {
  creator_name?: string | null;
  going_count?: number;
  interested_count?: number;
  my_status?: RsvpStatus | null;
};

export type PrayerRequest = {
  id: string;
  church_id: string;
  user_id: string;
  content: string;
  is_anonymous: boolean;
  prayer_count: number;
  created_at: string;
};

export type Devotional = {
  id: string;
  church_id: string;
  title: string;
  content: string;
  bible_verse: string | null;
  publish_date: string;
  created_at: string;
};

// Community guidelines - banned keywords for content moderation
export const BANNED_TOPICS_REGEX =
  /\b(politic|democrat|republican|trump|biden|election|vote for|congress|senator|liberal|conservative|nfl|nba|mlb|fifa|premier league|champions league|world cup|super bowl|playoffs|touchdown|goalkeeper|striker|quarterback)\b/i;

export function checkContentGuidelines(text: string): { ok: boolean; message: string } {
  if (BANNED_TOPICS_REGEX.test(text)) {
    return {
      ok: false,
      message: "This platform is dedicated to faith and Christianity. Posts about politics or sports are not allowed. Please keep conversations centered on faith.",
    };
  }
  return { ok: true, message: "" };
}
