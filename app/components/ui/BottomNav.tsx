"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type BottomNavProps = {
  unreadCount?: number;
  onCompose?: () => void;
};

export default function BottomNav({ unreadCount, onCompose }: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [selfCount, setSelfCount] = useState(0);

  // Auto-fetch and subscribe to real-time notification count
  // Prefetch common routes so navigation feels instant
  useEffect(() => {
    router.prefetch("/feed");
    router.prefetch("/messages");
    router.prefetch("/notifications");
    router.prefetch("/profile");
    router.prefetch("/search");
  }, [router]);

  useEffect(() => {
    if (unreadCount !== undefined) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const loadCount = async (userId: string) => {
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("recipient_user_id", userId)
        .eq("is_read", false);
      if (!error && !cancelled) {
        setSelfCount(count || 0);
      }
    };

    const setup = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId || cancelled) return;

      await loadCount(userId);

      const channelName = `bottomnav-notifs-${userId}`;
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
          () => { void loadCount(userId); }
        )
        .subscribe();
    };

    setup();

    // Also reload count when tab becomes visible again
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        supabase.auth.getSession().then(({ data: { session } }) => {
          const userId = session?.user?.id;
          if (userId) void loadCount(userId);
        });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (channel) supabase.removeChannel(channel);
    };
  }, [unreadCount]);

  const badgeCount = unreadCount !== undefined ? unreadCount : selfCount;

  const isActive = (path: string) => pathname.startsWith(path);

  const tabs = [
    {
      label: "Home",
      path: "/feed",
      icon: (active: boolean) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
          <path d="M9 21V12h6v9" />
        </svg>
      ),
    },
    {
      label: "Search",
      path: "/search",
      icon: (active: boolean) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      ),
    },
    {
      label: "Post",
      path: "__compose__",
      icon: (_active: boolean) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      ),
      compose: true,
    },
    {
      label: "Alerts",
      path: "/notifications",
      badge: badgeCount,
      icon: (active: boolean) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
      ),
    },
    {
      label: "Profile",
      path: "/profile",
      icon: (active: boolean) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
        {tabs.map((tab) => {
          if (tab.compose) {
            return (
              <button
                key="compose"
                onClick={onCompose}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-brand-500 shadow-lg"
                aria-label="Create post"
              >
                {tab.icon(false)}
              </button>
            );
          }

          const active = isActive(tab.path);

          return (
            <button
              key={tab.path}
              onClick={() => router.push(tab.path)}
              className={`relative flex flex-col items-center gap-0.5 px-3 py-1 transition ${
                active ? "text-amber-500" : "text-gray-400 hover:text-gray-600"
              }`}
              aria-label={tab.label}
            >
              {tab.icon(active)}
              {tab.badge && tab.badge > 0 ? (
                <span className="absolute -right-0.5 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {tab.badge > 9 ? "9+" : tab.badge}
                </span>
              ) : null}
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
