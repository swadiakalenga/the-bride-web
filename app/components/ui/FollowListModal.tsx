"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { useLanguage } from "../../../lib/useLanguage";

type UserRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  country: string | null;
};

type Props = {
  /** The user whose followers/following we are showing */
  targetUserId: string;
  type: "followers" | "following";
  /** The currently logged-in user (null = not logged in) */
  currentUserId: string | null;
  onClose: () => void;
};

export default function FollowListModal({ targetUserId, type, currentUserId, onClose }: Props) {
  const router = useRouter();
  const { t } = useLanguage();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Escape to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId, type]);

  async function load() {
    setLoading(true);

    // Step 1: get the relevant user IDs from the follows table
    let userIds: string[] = [];

    if (type === "followers") {
      const { data } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("following_id", targetUserId);
      userIds = (data ?? []).map((r: { follower_id: string }) => r.follower_id);
    } else {
      const { data } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", targetUserId);
      userIds = (data ?? []).map((r: { following_id: string }) => r.following_id);
    }

    if (userIds.length === 0) {
      setUsers([]);
      setLoading(false);
      return;
    }

    // Step 2: fetch profiles for those IDs
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, city, country")
      .in("id", userIds);

    setUsers((profiles as UserRow[]) ?? []);

    // Step 3: if logged in, find which of these users the current user follows
    if (currentUserId && userIds.length > 0) {
      const { data: myFollows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", currentUserId)
        .in("following_id", userIds);
      setFollowingSet(new Set((myFollows ?? []).map((r: { following_id: string }) => r.following_id)));
    }

    setLoading(false);
  }

  const toggleFollow = async (userId: string) => {
    if (!currentUserId || togglingId) return;
    setTogglingId(userId);

    const isFollowing = followingSet.has(userId);
    if (isFollowing) {
      await supabase.from("follows").delete()
        .eq("follower_id", currentUserId)
        .eq("following_id", userId);
      setFollowingSet((prev) => { const s = new Set(prev); s.delete(userId); return s; });
    } else {
      await supabase.from("follows").insert([{ follower_id: currentUserId, following_id: userId }]);
      setFollowingSet((prev) => new Set([...prev, userId]));
    }
    setTogglingId(null);
  };

  const goToProfile = (userId: string) => {
    onClose();
    router.push(`/user/${userId}`);
  };

  const title = type === "followers" ? t("profile_followers") : t("profile_following");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Sheet */}
      <div
        className="relative z-10 flex w-full max-w-md flex-col rounded-t-2xl bg-white sm:rounded-2xl"
        style={{ maxHeight: "80vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="font-bold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
            aria-label={t("common_close")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
            </div>
          ) : users.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-gray-400">
              {t("admin_no_data")}
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {users.map((u) => {
                const isMe = u.id === currentUserId;
                const isFollowed = followingSet.has(u.id);
                const location = [u.city, u.country].filter(Boolean).join(", ");

                return (
                  <li key={u.id} className="flex items-center gap-3 px-5 py-3">
                    {/* Avatar — tap goes to profile */}
                    <button
                      onClick={() => goToProfile(u.id)}
                      className="shrink-0"
                      aria-label={`View ${u.full_name ?? "profile"}`}
                    >
                      {u.avatar_url ? (
                        <img
                          src={u.avatar_url}
                          alt={u.full_name ?? "Avatar"}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700">
                          {(u.full_name ?? "?").charAt(0).toUpperCase()}
                        </div>
                      )}
                    </button>

                    {/* Name + location — tap goes to profile */}
                    <button
                      onClick={() => goToProfile(u.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate font-semibold text-gray-900">
                        {u.full_name ?? "—"}
                      </p>
                      {location && (
                        <p className="truncate text-xs text-gray-400">{location}</p>
                      )}
                    </button>

                    {/* Follow/unfollow — only show when logged in and not own row */}
                    {currentUserId && !isMe && (
                      <button
                        disabled={togglingId === u.id}
                        onClick={() => toggleFollow(u.id)}
                        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                          isFollowed
                            ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            : "bg-amber-500 text-white hover:bg-amber-600"
                        }`}
                      >
                        {isFollowed ? t("feed_following") : t("feed_follow")}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
