"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import Spinner from "../components/ui/Spinner";
import Button from "../components/ui/Button";
import BottomNav from "../components/ui/BottomNav";
import type { NotificationItem } from "../../lib/types";

export default function NotificationsPage() {
  const router = useRouter();
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
      .select("id, type, created_at, is_read, post_id, comment_id, conversation_id, actor_user_id")
      .eq("recipient_user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      setUiMessage(`Load notifications failed: ${error.message}`);
      setLoading(false);
      return;
    }

    const actorIds = [...new Set((data || []).map((n) => n.actor_user_id))];

    const actorMap: Record<
      string,
      { id: string; full_name: string | null; avatar_url: string | null }
    > = {};

    if (actorIds.length > 0) {
      const { data: actors, error: actorsError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", actorIds);

      if (actorsError) {
        setUiMessage(`Load actors failed: ${actorsError.message}`);
        setLoading(false);
        return;
      }

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
          () => {
            loadNotifications();
          }
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      cancelled = true;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    if (!currentUserId) return;

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_user_id", currentUserId)
      .in("id", unreadIds);

    if (error) {
      setUiMessage(`Mark all read failed: ${error.message}`);
      return;
    }

    setNotifications((prev) =>
      prev.map((notification) => ({
        ...notification,
        is_read: true,
      }))
    );
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
      prev.map((notification) =>
        notification.id === id
          ? { ...notification, is_read: true }
          : notification
      )
    );

    return true;
  };

  const getText = (notification: NotificationItem) => {
    const name = notification.actor?.full_name || "Someone";

    switch (notification.type) {
      case "follow":
        return `${name} started following you`;
      case "like":
        return `${name} liked your post`;
      case "comment":
        return `${name} commented on your post`;
      case "reply":
        return `${name} replied to your comment`;
      case "membership_request":
        return `${name} requested to join your church`;
      case "message":
        return `${name} sent you a message`;
      case "message_request":
        return `${name} sent you a message request`;
      case "tag":
        return `${name} tagged you in a post`;
      case "prayer":
        return `${name} prayed for your request`;
      case "event":
        return `New event from your church`;
      default:
        return "New notification";
    }
  };

  const getLink = (notification: NotificationItem) => {
    if (notification.type === "message" || notification.type === "message_request") {
      if (notification.conversation_id) {
        return `/messages/${notification.conversation_id}`;
      }
      return "/messages";
    }

    if (notification.type === "membership_request") {
      return "/profile";
    }

    if (notification.type === "follow" && notification.actor?.id) {
      return `/user/${notification.actor.id}`;
    }

    if (notification.type === "tag" && notification.post_id) {
      return `/post/${notification.post_id}`;
    }

    if (notification.type === "prayer") {
      return "/feed";
    }

    if (notification.type === "event") {
      return "/feed";
    }

    if (notification.post_id) {
      if (notification.comment_id) {
        return `/post/${notification.post_id}?commentId=${notification.comment_id}`;
      }
      return `/post/${notification.post_id}`;
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
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
              aria-label="Go back"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Notifications</h1>
              <p className="text-xs text-gray-400">
                {unreadCount > 0
                  ? `${unreadCount} unread`
                  : "All caught up"}
              </p>
            </div>
          </div>

          <Button onClick={markAllAsRead} disabled={unreadCount === 0} size="sm">
            Mark all read
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
            title="No notifications yet"
            description="When someone follows, likes, comments, or replies, it will appear here."
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