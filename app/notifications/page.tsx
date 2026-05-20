"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useLanguage } from "../../lib/useLanguage";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import Spinner from "../components/ui/Spinner";
import Button from "../components/ui/Button";
import BottomNav from "../components/ui/BottomNav";
import type { NotificationItem } from "../../lib/types";

export default function NotificationsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uiMessage, setUiMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  async function loadNotifications() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    if (!userId) {
      setLoading(false);
      router.push("/login");
      return;
    }

    setCurrentUserId(userId);

    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, created_at, is_read, post_id, comment_id, conversation_id, church_id, actor_user_id")
      .eq("recipient_user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      setUiMessage(`${t("common_error")} (${error.message})`);
      setLoading(false);
      return;
    }

    const actorIds = [...new Set((data || []).map((n) => n.actor_user_id).filter(Boolean))];

    const actorMap: Record<
      string,
      { id: string; full_name: string | null; avatar_url: string | null }
    > = {};

    if (actorIds.length > 0) {
      const { data: actors } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", actorIds);

      (actors || []).forEach((actor) => {
        actorMap[actor.id] = actor;
      });
    }

    const merged = (data || []).map((n) => ({
      ...n,
      actor: actorMap[n.actor_user_id],
    }));

    setNotifications(merged);
    setLoading(false);
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const setupRealtime = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId || cancelled) return;

      const channelName = `notifications-page-${userId}`;
      await supabase.removeChannel(supabase.channel(channelName));

      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `recipient_user_id=eq.${userId}`,
          },
          () => { loadNotifications(); }
        )
        .subscribe();
    };

    setupRealtime();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0 || !currentUserId) return;

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_user_id", currentUserId)
      .in("id", unreadIds);

    if (error) { setUiMessage(t("common_error")); return; }

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const markOneAsRead = async (id: string) => {
    if (!currentUserId) return false;
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_user_id", currentUserId)
      .eq("id", id);
    if (error) return false;
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    return true;
  };

  const getText = (n: NotificationItem): string => {
    const name = n.actor?.full_name || "Someone";
    switch (n.type) {
      case "follow":            return t("notif_follow", name);
      case "like":              return t("notif_like", name);
      case "comment":           return t("notif_comment", name);
      case "reply":             return t("notif_reply", name);
      case "membership_request":  return t("notif_membership_request", name);
      case "membership_approved": return t("notif_membership_approved", name);
      case "membership_rejected": return t("notif_membership_rejected", name);
      case "church_verified":     return t("notif_church_verified");
      case "church_rejected":     return t("notif_church_rejected");
      case "message":             return t("notif_message", name);
      case "message_request":     return t("notif_message_request", name);
      case "tag":                 return t("notif_tag", name);
      case "prayer":              return t("notif_prayer", name);
      case "event":               return t("notif_event");
      default:                    return t("notif_default");
    }
  };

  const getLink = (n: NotificationItem): string => {
    if (n.type === "message" || n.type === "message_request") {
      return n.conversation_id ? `/messages/${n.conversation_id}` : "/messages";
    }

    // Membership request → admin reviews at /church/[id]/members
    if (n.type === "membership_request") {
      return n.church_id ? `/church/${n.church_id}/members` : "/profile";
    }

    // Membership outcome → user sees their status on the church page
    if (n.type === "membership_approved" || n.type === "membership_rejected") {
      return n.church_id ? `/church/${n.church_id}` : "/feed";
    }

    // Church verification outcome → church admin sees their church page
    if (n.type === "church_verified" || n.type === "church_rejected") {
      return n.church_id ? `/church/${n.church_id}` : "/profile";
    }

    if (n.type === "follow" && n.actor?.id) return `/user/${n.actor.id}`;
    if (n.type === "tag" && n.post_id) return `/post/${n.post_id}`;
    if (n.type === "prayer" || n.type === "event") return "/feed";

    if (n.post_id) {
      return n.comment_id
        ? `/post/${n.post_id}?commentId=${n.comment_id}`
        : `/post/${n.post_id}`;
    }

    return "/feed";
  };

  const handleNotificationClick = async (
    e: React.MouseEvent<HTMLAnchorElement>,
    notification: NotificationItem
  ) => {
    e.preventDefault();
    await markOneAsRead(notification.id);
    router.push(getLink(notification));
  };

  const renderAvatar = (notification: NotificationItem) => {
    const actorName = notification.actor?.full_name || "User";
    const actorAvatar = notification.actor?.avatar_url;

    if (actorAvatar) {
      return (
        <img
          src={actorAvatar}
          alt={actorName}
          className="h-11 w-11 rounded-full border object-cover"
        />
      );
    }

    return (
      <div className="flex h-11 w-11 items-center justify-center rounded-full border bg-gray-200 font-bold text-gray-600">
        {actorName.charAt(0).toUpperCase()}
      </div>
    );
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
              aria-label={t("common_back")}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{t("notif_title")}</h1>
              <p className="text-xs text-gray-400">
                {unreadCount > 0 ? t("notif_unread", unreadCount) : t("notif_all_read")}
              </p>
            </div>
          </div>

          <Button onClick={markAllAsRead} disabled={unreadCount === 0} size="sm">
            {t("notif_mark_all")}
          </Button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg px-4 pt-4">
        {uiMessage && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {uiMessage}
          </div>
        )}

        {loading ? (
          <Spinner />
        ) : notifications.length === 0 ? (
          <EmptyState
            title={t("notif_empty_title")}
            description={t("notif_empty_desc")}
          />
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <a
                key={notification.id}
                href={getLink(notification)}
                onClick={(e) => handleNotificationClick(e, notification)}
                className="block"
              >
                <Card
                  className={`transition hover:shadow-md ${
                    notification.is_read ? "bg-white" : "bg-amber-50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {renderAvatar(notification)}

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800">
                        {getText(notification)}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {new Date(notification.created_at).toLocaleString()}
                      </p>
                    </div>

                    {!notification.is_read && (
                      <span className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-amber-400" />
                    )}
                  </div>
                </Card>
              </a>
            ))}
          </div>
        )}
      </div>

      <BottomNav unreadCount={unreadCount} />
    </main>
  );
}
