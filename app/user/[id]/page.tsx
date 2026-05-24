"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { useLanguage } from "../../../lib/useLanguage";
import { createNotification } from "../../../lib/notificationPush";
import { useRedirectIfPlatformAdmin } from "../../../lib/auth/redirectIfPlatformAdmin";
import BottomNav from "../../components/ui/BottomNav";
import Card from "../../components/ui/Card";
import FollowListModal from "../../components/ui/FollowListModal";
import PostCard from "../../components/feed/PostCard";
import type { Post } from "../../../lib/types";

type Profile = {
  id: string;
  full_name: string | null;
  role: string | null;
  avatar_url: string | null;
  city: string | null;
  country: string | null;
  church_id: string | null;
  bio: string | null;
  account_type: string | null;
};

type Church = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  pastor_name: string | null;
  description: string | null;
  email: string | null;
  phone: string | null;
};

export default function UserProfilePage() {
  useRedirectIfPlatformAdmin();
  const params = useParams();
  const router = useRouter();
  const { t, lang } = useLanguage();
  const userId = params?.id as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [church, setChurch] = useState<Church | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myAccountType, setMyAccountType] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [theyFollowMe, setTheyFollowMe] = useState(false);
  const [isFollowingChurch, setIsFollowingChurch] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followModal, setFollowModal] = useState<"followers" | "following" | null>(null);
  const [loading, setLoading] = useState(true);
  const [uiMessage, setUiMessage] = useState("");

  // Messaging state
  const [existingConvId, setExistingConvId] = useState<string | null>(null);
  const [pendingRequestExists, setPendingRequestExists] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [messagingLoading, setMessagingLoading] = useState(false);

  // Membership state
  const [membershipStatus, setMembershipStatus] = useState<"none" | "pending" | "member" | "rejected">("none");
  const [membershipLoading, setMembershipLoading] = useState(false);

  // Posts section
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [userSharedPosts, setUserSharedPosts] = useState<Post[]>([]);
  const [postLikeCounts, setPostLikeCounts] = useState<Record<string, number>>({});
  const [postUserLikes, setPostUserLikes] = useState<Record<string, boolean>>({});
  const [postShareCounts, setPostShareCounts] = useState<Record<string, number>>({});
  const [postUserShares, setPostUserShares] = useState<Record<string, boolean>>({});

  // Block / Mute / Report state
  const [isBlocked, setIsBlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("harassment");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

  useEffect(() => {
    if (userId) loadPage();
  }, [userId]);

  useEffect(() => {
    if (!currentUserId || !userId || currentUserId === userId) return;
    supabase.rpc("get_relationship_status", { other_user_id: userId }).then(({ data }) => {
      if (data) {
        setIsBlocked(!!data.is_blocking);
        setIsMuted(!!data.is_muting);
      }
    });
  }, [currentUserId, userId]);

  const toggleBlock = async () => {
    if (!currentUserId || !profile) return;
    if (isBlocked) {
      await supabase.from("user_blocks").delete()
        .eq("blocker_id", currentUserId).eq("blocked_id", profile.id);
      setIsBlocked(false);
    } else {
      await supabase.from("user_blocks").insert([{ blocker_id: currentUserId, blocked_id: profile.id }]);
      setIsBlocked(true);
    }
    setShowActionsMenu(false);
  };

  const toggleMute = async () => {
    if (!currentUserId || !profile) return;
    if (isMuted) {
      await supabase.from("user_mutes").delete()
        .eq("muter_id", currentUserId).eq("muted_id", profile.id);
      setIsMuted(false);
    } else {
      await supabase.from("user_mutes").insert([{ muter_id: currentUserId, muted_id: profile.id }]);
      setIsMuted(true);
    }
    setShowActionsMenu(false);
  };

  const submitReport = async () => {
    if (!currentUserId || !profile) return;
    setReportSubmitting(true);
    await supabase.rpc("submit_report", {
      p_target_type: "user",
      p_target_id: profile.id,
      p_reason: reportReason,
      p_details: reportDetails || null,
    });
    setReportSubmitting(false);
    setShowReportModal(false);
    setReportDetails("");
    setUiMessage("Report submitted.");
  };

  async function loadPage() {
    setLoading(true);

    const { data: authData } = await supabase.auth.getUser();
    const me = authData.user?.id || null;
    setCurrentUserId(me);

    const { data: profileData, error } = await supabase
      .from("profiles")
      .select("id, full_name, role, avatar_url, city, country, church_id, bio, account_type")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      setUiMessage(error.message);
      setLoading(false);
      return;
    }
    setProfile(profileData);

    if (profileData?.church_id) {
      const { data: churchData } = await supabase
        .from("churches")
        .select("id, name, city, country, pastor_name, description, email, phone")
        .eq("id", profileData.church_id)
        .maybeSingle();
      setChurch(churchData || null);

      if (me) {
        const { data: churchFollowData } = await supabase
          .from("church_follows")
          .select("*")
          .eq("user_id", me)
          .eq("church_id", profileData.church_id)
          .maybeSingle();
        setIsFollowingChurch(!!churchFollowData);
      }
    } else {
      setChurch(null);
      setIsFollowingChurch(false);
    }

    const [{ count: followers }, { count: following }] = await Promise.all([
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId),
    ]);

    setFollowersCount(followers || 0);
    setFollowingCount(following || 0);

    if (me) {
      const [{ data: followData }, { data: reverseFollowData }, { data: myProfileData }] = await Promise.all([
        supabase.from("follows").select("*").eq("follower_id", me).eq("following_id", userId).maybeSingle(),
        supabase.from("follows").select("*").eq("follower_id", userId).eq("following_id", me).maybeSingle(),
        supabase.from("profiles").select("account_type").eq("id", me).maybeSingle(),
      ]);

      setIsFollowing(!!followData);
      setTheyFollowMe(!!reverseFollowData);
      setMyAccountType(myProfileData?.account_type || null);

      await loadMessagingState(me, userId);

      // Membership — only relevant when visiting a church admin's profile
      if (profileData?.role === "church_admin" && profileData?.church_id) {
        const { data: memData } = await supabase
          .from("church_memberships")
          .select("status")
          .eq("church_id", profileData.church_id)
          .eq("user_id", me)
          .maybeSingle();
        setMembershipStatus((memData?.status as typeof membershipStatus) || "none");

      }
    }

    setLoading(false);
    loadUserPosts(userId, me);
  }

  const USER_POST_COLS = "id, user_id, church_id, content, media_urls, media_type, author_name, tagged_user_ids, created_at, updated_at, link_url, link_title, link_description, link_image_url, link_site_name, link_domain";

  const loadUserPosts = async (ownerId: string, viewerId: string | null) => {
    const [{ data: ownPostsData }, { data: sharesData }] = await Promise.all([
      supabase.from("posts").select(USER_POST_COLS).eq("user_id", ownerId).is("church_id", null).order("created_at", { ascending: false }).limit(15),
      supabase.from("post_shares").select("post_id, created_at").eq("user_id", ownerId).order("created_at", { ascending: false }).limit(15),
    ]);

    const ownPosts = ownPostsData || [];
    setUserPosts(ownPosts);

    let sharedPostList: Post[] = [];
    if (sharesData && sharesData.length > 0) {
      const { data: sharedData } = await supabase
        .from("posts")
        .select(USER_POST_COLS)
        .in("id", sharesData.map((s) => s.post_id));
      sharedPostList = sharedData || [];
    }
    setUserSharedPosts(sharedPostList);

    const allIds = [...ownPosts.map((p) => p.id), ...sharedPostList.map((p) => p.id)];
    if (allIds.length === 0) return;

    const [{ data: likeData }, { data: shareCountData }] = await Promise.all([
      supabase.from("likes").select("post_id, user_id").in("post_id", allIds),
      supabase.from("post_shares").select("post_id, user_id").in("post_id", allIds),
    ]);

    const lCounts: Record<string, number> = {};
    const lUser: Record<string, boolean> = {};
    likeData?.forEach((l) => {
      lCounts[l.post_id] = (lCounts[l.post_id] || 0) + 1;
      if (viewerId && l.user_id === viewerId) lUser[l.post_id] = true;
    });

    const sCounts: Record<string, number> = {};
    const sUser: Record<string, boolean> = {};
    shareCountData?.forEach((s) => {
      sCounts[s.post_id] = (sCounts[s.post_id] || 0) + 1;
      if (viewerId && s.user_id === viewerId) sUser[s.post_id] = true;
    });

    setPostLikeCounts(lCounts);
    setPostUserLikes(lUser);
    setPostShareCounts(sCounts);
    setPostUserShares(sUser);
  };

  const toggleUserPostLike = async (postId: string) => {
    if (!currentUserId) return;
    const liked = postUserLikes[postId];
    setPostUserLikes((p) => ({ ...p, [postId]: !liked }));
    setPostLikeCounts((p) => ({ ...p, [postId]: Math.max(0, (p[postId] || 0) + (liked ? -1 : 1)) }));
    if (liked) {
      await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", currentUserId);
    } else {
      await supabase.from("likes").insert([{ post_id: postId, user_id: currentUserId }]);
    }
  };

  const toggleUserPostShare = async (postId: string) => {
    if (!currentUserId) return;
    const shared = postUserShares[postId];
    setPostUserShares((p) => ({ ...p, [postId]: !shared }));
    setPostShareCounts((p) => ({ ...p, [postId]: Math.max(0, (p[postId] || 0) + (shared ? -1 : 1)) }));
    if (shared) {
      await supabase.from("post_shares").delete().eq("post_id", postId).eq("user_id", currentUserId);
      // Remove from this user's shared posts display if viewing own profile
      setUserSharedPosts((prev) => prev.filter((p) => p.id !== postId));
    } else {
      await supabase.from("post_shares").insert([{ post_id: postId, user_id: currentUserId }]);
    }
  };

  const handleOwnPostEdit = async (updatedPost: Post) => {
    if (!currentUserId) return;
    const { error } = await supabase
      .from("posts")
      .update({ content: updatedPost.content })
      .eq("id", updatedPost.id)
      .eq("user_id", currentUserId);
    if (!error) {
      setUserPosts((prev) => prev.map((p) => p.id === updatedPost.id ? { ...p, content: updatedPost.content } : p));
    }
  };

  const handleOwnPostDelete = async (postId: string) => {
    if (!currentUserId) return;
    await supabase.from("posts").delete().eq("id", postId).eq("user_id", currentUserId);
    setUserPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const loadMessagingState = async (me: string, targetId: string) => {
    const { data: myParticipations } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", me);

    if (myParticipations && myParticipations.length > 0) {
      const convIds = myParticipations.map((p) => p.conversation_id);
      const { data: sharedConv } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", targetId)
        .in("conversation_id", convIds)
        .maybeSingle();

      setExistingConvId(sharedConv?.conversation_id || null);
    } else {
      setExistingConvId(null);
    }

    const { data: reqData } = await supabase
      .from("message_requests")
      .select("id")
      .eq("sender_id", me)
      .eq("recipient_id", targetId)
      .eq("status", "pending")
      .maybeSingle();

    setPendingRequestExists(!!reqData);
  };

  const handleMessageClick = () => {
    if (!currentUserId || !profile) return;
    if (existingConvId) {
      router.push(`/messages/${existingConvId}`);
      return;
    }
    setShowRequestModal(true);
  };

  const sendMessage = async () => {
    if (!currentUserId || !profile || !requestMessage.trim()) return;
    setMessagingLoading(true);

    const targetIsChurch = profile.account_type === "church" || profile.role === "church_admin";
    const mutualFollow = isFollowing && theyFollowMe;
    const canDirectMessage = mutualFollow || targetIsChurch;

    if (canDirectMessage) {
      // Use SECURITY DEFINER RPC — avoids RLS issues on conversations/participants
      const { data: convId, error: convError } = await supabase
        .rpc("create_direct_conversation", {
          p_other_user_id: profile.id,
          p_message: requestMessage.trim(),
        });

      if (convError || !convId) {
        setMessagingLoading(false);
        setUiMessage(`Could not start conversation: ${convError?.message || "unknown error"}`);
        return;
      }

      setMessagingLoading(false);
      setShowRequestModal(false);
      setRequestMessage("");
      router.push(`/messages/${convId}`);
    } else {
      // Plain insert — avoids upsert's requirement for a UNIQUE constraint on (sender_id,recipient_id).
      const { error } = await supabase.from("message_requests").insert({
        sender_id: currentUserId,
        recipient_id: profile.id,
        initial_message: requestMessage.trim(),
        status: "pending",
      });

      // Notify recipient of message request
      if (!error) {
        await createNotification({
          recipientUserId: profile.id,
          actorUserId: currentUserId,
          type: "message_request",
        });
      }

      setMessagingLoading(false);
      setShowRequestModal(false);
      setRequestMessage("");

      if (error) {
        setUiMessage(`Could not send request: ${error.message}`);
      } else {
        setPendingRequestExists(true);
        setUiMessage("Message request sent.");
      }
    }
  };

  const requestMembership = async () => {
    if (!currentUserId || !profile?.church_id || !profile?.id) return;
    setMembershipLoading(true);
    const { error } = await supabase.from("church_memberships").upsert([{
      church_id: profile.church_id,
      user_id: currentUserId,
      status: "pending",
    }], { onConflict: "church_id,user_id" });

    if (!error) {
      // Notify the church admin; church_id links the notification to /church/[id]/members
      await createNotification({
        recipientUserId: profile.id,
        actorUserId: currentUserId,
        type: "membership_request",
        churchId: profile.church_id,
      });
      setMembershipStatus("pending");
      setUiMessage("Demande d'adhésion envoyée.");
    } else {
      setUiMessage(error.message);
    }
    setMembershipLoading(false);
  };

  const toggleFollow = async () => {
    if (!currentUserId || !profile) {
      router.push("/login");
      return;
    }
    if (currentUserId === profile.id) return;
    // platform_admin accounts must not follow social users
    const { data: myProf } = await supabase.from("profiles").select("role").eq("id", currentUserId).maybeSingle();
    if (myProf?.role === "platform_admin") return;

    const { error } = isFollowing
      ? await supabase.from("follows").delete().eq("follower_id", currentUserId).eq("following_id", profile.id)
      : await supabase.from("follows").insert([{ follower_id: currentUserId, following_id: profile.id }]);

    if (error) {
      setUiMessage(error.message);
      return;
    }

    loadPage();
  };

  const toggleChurchFollow = async () => {
    if (!currentUserId || !church) {
      router.push("/login");
      return;
    }
    // platform_admin accounts must not follow churches
    const { data: myProf } = await supabase.from("profiles").select("role").eq("id", currentUserId).maybeSingle();
    if (myProf?.role === "platform_admin") return;

    const { error } = isFollowingChurch
      ? await supabase.from("church_follows").delete().eq("user_id", currentUserId).eq("church_id", church.id)
      : await supabase.from("church_follows").insert([{ user_id: currentUserId, church_id: church.id }]);

    if (error) {
      setUiMessage(error.message);
      return;
    }

    loadPage();
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">User not found.</p>
      </main>
    );
  }

  const avatarLetter = (profile.full_name || "U").trim().charAt(0).toUpperCase();
  const isOwnProfile = currentUserId === profile.id;
  const isChurchProfile = profile.role === "church_admin";
  // Church admins should NOT see membership/tithe buttons (they grant, not request)
  const amIChurchAdmin = myAccountType === "church";
  const firstName = profile.full_name?.split(" ")[0] || "them";

  return (
    <main className="min-h-screen bg-gray-50 pb-24 lg:pb-6">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg lg:max-w-7xl items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="truncate text-lg font-bold text-gray-900">{profile.full_name || "Profile"}</h1>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 pt-4">
        <div className="grid grid-cols-12 gap-6">

          {/* ── Left sidebar ── */}
          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-[72px] space-y-3">
              <Card>
                <nav className="space-y-0.5">
                  <button
                    onClick={() => router.push("/feed")}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-gray-400">
                      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
                      <path d="M9 21V12h6v9" />
                    </svg>
                    Home
                  </button>
                  <button
                    onClick={() => router.push("/search")}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-gray-400">
                      <circle cx="11" cy="11" r="8" />
                      <path d="M21 21l-4.35-4.35" />
                    </svg>
                    Search
                  </button>
                  <button
                    onClick={() => router.push("/messages")}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-gray-400">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                    Messages
                  </button>
                  <button
                    onClick={() => router.push("/notifications")}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-gray-400">
                      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 01-3.46 0" />
                    </svg>
                    Alerts
                  </button>
                  <button
                    onClick={() => router.push("/profile")}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-gray-400">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    My Profile
                  </button>
                </nav>
              </Card>

              {isChurchProfile && church && (
                <Card>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Church</p>
                  <button
                    onClick={() => router.push(`/church/${church.id}`)}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-brand-50"
                  >
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-600">
                      {church.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="truncate text-sm font-medium text-brand-600">{church.name}</span>
                  </button>
                </Card>
              )}
            </div>
          </aside>

          {/* ── Center content ── */}
          <section className="col-span-12 lg:col-span-6 space-y-4">
            {uiMessage && (
              <div className={`rounded-xl px-4 py-3 text-sm ${uiMessage.toLowerCase().includes("sent") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                {uiMessage}
              </div>
            )}

            {/* Profile card */}
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
              <div className="flex flex-col items-center">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="h-28 w-28 rounded-full border-4 border-brand-100 object-cover" />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-brand-100 brand-gradient-bg text-4xl font-bold text-white">
                    {avatarLetter}
                  </div>
                )}

                <h2 className="mt-4 text-2xl font-bold text-gray-900">{profile.full_name || "Unknown"}</h2>

                {isChurchProfile && church?.pastor_name && (
                  <p className="mt-1 text-sm text-gray-500">Pastor: {church.pastor_name}</p>
                )}

                {/* Stats */}
                <div className="mt-4 flex w-full items-center justify-center gap-8 rounded-xl bg-gray-50 p-4">
                  <button
                    onClick={() => setFollowModal("followers")}
                    className="text-center hover:opacity-75 transition-opacity"
                  >
                    <p className="text-2xl font-bold text-gray-900">{followersCount}</p>
                    <p className="text-sm text-gray-500">{t("profile_followers")}</p>
                  </button>
                  <div className="h-8 w-px bg-gray-200" />
                  <button
                    onClick={() => setFollowModal("following")}
                    className="text-center hover:opacity-75 transition-opacity"
                  >
                    <p className="text-2xl font-bold text-gray-900">{followingCount}</p>
                    <p className="text-sm text-gray-500">{t("profile_following")}</p>
                  </button>
                </div>

                {/* Action buttons — only for other people's profiles */}
                {!isOwnProfile && currentUserId && (
                  <div className="mt-4 flex w-full gap-2">
                    <button
                      onClick={toggleFollow}
                      className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
                        isFollowing
                          ? "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                          : "bg-brand-600 text-white hover:bg-brand-700"
                      }`}
                    >
                      {isFollowing ? "Unfollow" : "Follow"}
                    </button>

                    <button
                      onClick={handleMessageClick}
                      disabled={messagingLoading || pendingRequestExists}
                      className="flex-1 rounded-xl border border-gray-300 bg-white py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                      {messagingLoading ? "..." : pendingRequestExists ? "Request sent" : "Message"}
                    </button>

                    {/* Block / Mute / Report overflow menu */}
                    <div className="relative">
                      <button
                        onClick={() => setShowActionsMenu((v) => !v)}
                        className="flex h-[42px] w-10 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-500 hover:bg-gray-50"
                        aria-label="More actions"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
                        </svg>
                      </button>
                      {showActionsMenu && (
                        <div className="absolute right-0 top-12 z-30 w-44 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                          <button
                            onClick={toggleMute}
                            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            {isMuted ? "Unmute" : "Mute"}
                          </button>
                          <button
                            onClick={toggleBlock}
                            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                          >
                            {isBlocked ? "Unblock" : "Block"}
                          </button>
                          <button
                            onClick={() => { setShowActionsMenu(false); setShowReportModal(true); }}
                            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                          >
                            Report
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Church follow button */}
                {isChurchProfile && church && !isOwnProfile && (
                  <button
                    onClick={toggleChurchFollow}
                    className={`mt-2 w-full rounded-xl py-2.5 text-sm font-semibold transition ${
                      isFollowingChurch
                        ? "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                        : "bg-brand-500 text-white hover:bg-brand-600"
                    }`}
                  >
                    {isFollowingChurch ? "Following Church" : `Follow ${church.name}`}
                  </button>
                )}

                {/* Membership button — shown only to non-church-admin visitors */}
                {isChurchProfile && profile.church_id && !isOwnProfile && !amIChurchAdmin && (
                  <button
                    onClick={membershipStatus === "none" ? requestMembership : undefined}
                    disabled={membershipLoading || membershipStatus === "pending" || membershipStatus === "member"}
                    className={`mt-2 w-full rounded-xl py-2.5 text-sm font-semibold transition ${
                      membershipStatus === "member"
                        ? "bg-green-100 text-green-700 cursor-default"
                        : membershipStatus === "pending"
                        ? "bg-amber-50 text-amber-700 cursor-default"
                        : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                    }`}
                  >
                    {membershipLoading
                      ? "Requesting..."
                      : membershipStatus === "member"
                      ? "✓ Church Member"
                      : membershipStatus === "pending"
                      ? "⏳ Membership Pending"
                      : "Request Membership"}
                  </button>
                )}

                {/* Tithe button — only for confirmed members (not church admins) */}
                {isChurchProfile && profile.church_id && membershipStatus === "member" && !amIChurchAdmin && (
                  <button
                    onClick={() => router.push(`/church/${profile.church_id}/tithe`)}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-sm font-bold text-white hover:bg-emerald-600"
                  >
                    🙏 Give Tithe / Offering
                  </button>
                )}

                {/* Church admin: link to manage members */}
                {isOwnProfile && isChurchProfile && profile.church_id && (
                  <button
                    onClick={() => router.push(`/church/${profile.church_id}/members`)}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-50 py-2.5 text-sm font-semibold text-brand-600 hover:bg-brand-100"
                  >
                    👥 Manage Members
                  </button>
                )}
              </div>
            </div>

            {/* Info card */}
            <div className="rounded-2xl bg-white p-5 shadow-sm border border-gray-100 space-y-3 text-sm">
              <h3 className="font-semibold text-gray-900">About</h3>

              {profile.bio && (
                <p className="text-gray-700 leading-relaxed">{profile.bio}</p>
              )}

              <div className="space-y-2 text-gray-600">
                {(profile.city || profile.country) && (
                  <div className="flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-gray-400">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
                    </svg>
                    <span>{[profile.city, profile.country].filter(Boolean).join(", ")}</span>
                  </div>
                )}

                {/* Church-specific info */}
                {isChurchProfile && church && (
                  <>
                    {church.pastor_name && (
                      <div className="flex items-center gap-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-gray-400">
                          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
                        </svg>
                        <span>Pastor: <strong>{church.pastor_name}</strong></span>
                      </div>
                    )}

                    {church.email && (
                      <div className="flex items-center gap-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-gray-400">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
                        </svg>
                        <a href={`mailto:${church.email}`} className="text-brand-500 hover:underline">{church.email}</a>
                      </div>
                    )}

                    {church.phone && (
                      <div className="flex items-center gap-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-gray-400">
                          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14h0v2.92z" />
                        </svg>
                        <a href={`tel:${church.phone}`} className="text-brand-500 hover:underline">{church.phone}</a>
                      </div>
                    )}
                  </>
                )}

                {!isChurchProfile && church && (
                  <div className="flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-gray-400">
                      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9,22 9,12 15,12 15,22" />
                    </svg>
                    <span>Church: {church.name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Posts section ── */}
            {(userPosts.length > 0 || userSharedPosts.length > 0) && (
              <div className="mt-5 space-y-3">
                <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">
                  {lang === "fr" ? "Publications" : "Posts"}
                </h2>

                {userPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUserId={currentUserId}
                    likeCounts={postLikeCounts}
                    userLikes={postUserLikes}
                    onLike={toggleUserPostLike}
                    shareCounts={postShareCounts}
                    userShares={postUserShares}
                    onShare={currentUserId && currentUserId !== post.user_id ? toggleUserPostShare : undefined}
                    isOwner={currentUserId === post.user_id}
                    onEdit={currentUserId === post.user_id ? handleOwnPostEdit : undefined}
                    onDelete={currentUserId === post.user_id ? handleOwnPostDelete : undefined}
                    lang={lang}
                  />
                ))}

                {userSharedPosts.length > 0 && (
                  <>
                    <h2 className="pt-2 text-sm font-bold uppercase tracking-wide text-gray-500">
                      {lang === "fr" ? "Partagés" : "Shared"}
                    </h2>
                    {userSharedPosts.map((post) => (
                      <PostCard
                        key={`shared-${post.id}`}
                        post={post}
                        currentUserId={currentUserId}
                        likeCounts={postLikeCounts}
                        userLikes={postUserLikes}
                        onLike={toggleUserPostLike}
                        shareCounts={postShareCounts}
                        userShares={postUserShares}
                        onShare={currentUserId && currentUserId !== post.user_id ? toggleUserPostShare : undefined}
                        isOwner={false}
                        lang={lang}
                        sharedByName={profile?.full_name ?? null}
                      />
                    ))}
                  </>
                )}
              </div>
            )}
          </section>

          {/* ── Right sidebar ── */}
          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-[72px] space-y-3">

              {/* Stats */}
              <Card>
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">Stats</p>
                <div className="flex gap-2">
                  <div className="flex-1 rounded-xl bg-gray-50 p-3 text-center">
                    <p className="text-2xl font-bold text-gray-900">{followersCount}</p>
                    <p className="text-xs text-gray-500">Followers</p>
                  </div>
                  <div className="flex-1 rounded-xl bg-gray-50 p-3 text-center">
                    <p className="text-2xl font-bold text-gray-900">{followingCount}</p>
                    <p className="text-xs text-gray-500">Following</p>
                  </div>
                </div>
              </Card>

              {/* Connection status */}
              {!isOwnProfile && currentUserId && (
                <Card>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Connection</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`h-2 w-2 flex-shrink-0 rounded-full ${isFollowing ? "bg-amber-400" : "bg-gray-200"}`} />
                      <span className={isFollowing ? "text-gray-700" : "text-gray-400"}>
                        You follow {firstName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`h-2 w-2 flex-shrink-0 rounded-full ${theyFollowMe ? "bg-brand-400" : "bg-gray-200"}`} />
                      <span className={theyFollowMe ? "text-gray-700" : "text-gray-400"}>
                        {firstName} follows you
                      </span>
                    </div>
                  </div>
                </Card>
              )}

              {/* Location */}
              {(profile.city || profile.country) && (
                <Card>
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">Location</p>
                  <p className="flex items-center gap-2 text-sm text-gray-700">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-gray-400">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
                    </svg>
                    {[profile.city, profile.country].filter(Boolean).join(", ")}
                  </p>
                </Card>
              )}

              {/* Church info */}
              {church && (
                <Card>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                    {isChurchProfile ? "This Church" : "Member Church"}
                  </p>
                  <button
                    onClick={() => router.push(`/church/${church.id}`)}
                    className="w-full text-left"
                  >
                    <p className="text-sm font-semibold text-amber-600 hover:underline">{church.name}</p>
                    {(church.city || church.country) && (
                      <p className="mt-0.5 text-xs text-gray-400">
                        {[church.city, church.country].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </button>
                  {church.pastor_name && (
                    <p className="mt-1 text-xs text-gray-500">Pastor: {church.pastor_name}</p>
                  )}
                </Card>
              )}

            </div>
          </aside>

        </div>
      </div>

      {/* Message compose modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="w-full max-w-sm rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                Message {profile.full_name || "User"}
              </h2>
              <button
                onClick={() => { setShowRequestModal(false); setRequestMessage(""); }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
              >
                ✕
              </button>
            </div>

            {!(isFollowing && theyFollowMe) &&
             profile.account_type !== "church" &&
             profile.role !== "church_admin" && (
              <p className="mt-2 text-sm text-gray-500">
                Your message will be sent as a request — {profile.full_name || "this user"} can accept or ignore it.
              </p>
            )}

            <textarea
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
              placeholder="Write your message..."
              rows={4}
              autoFocus
              className="mt-4 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-amber-300 focus:bg-white"
            />

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => { setShowRequestModal(false); setRequestMessage(""); }}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={sendMessage}
                disabled={messagingLoading || !requestMessage.trim()}
                className="flex-1 rounded-xl bg-amber-400 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-60"
              >
                {messagingLoading ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="lg:hidden">
        <BottomNav />
      </div>

      {followModal && profile && (
        <FollowListModal
          targetUserId={profile.id}
          type={followModal}
          currentUserId={currentUserId}
          onClose={() => setFollowModal(null)}
        />
      )}

      {/* Report modal */}
      {showReportModal && profile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-1 text-lg font-bold text-gray-900">Report {profile.full_name}</h2>
            <p className="mb-4 text-sm text-gray-500">Your report is anonymous and will be reviewed by our moderation team.</p>

            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Reason</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                >
                  {[
                    ["harassment", "Harassment or bullying"],
                    ["hate_speech", "Hate speech"],
                    ["spam", "Spam or fake account"],
                    ["misinformation", "Misinformation"],
                    ["violence", "Violence or threats"],
                    ["nudity", "Nudity or sexual content"],
                    ["impersonation", "Impersonation"],
                    ["other", "Other"],
                  ].map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Details (optional)</label>
                <textarea
                  rows={3}
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Describe the issue…"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={submitReport}
                disabled={reportSubmitting}
                className="w-full rounded-full bg-red-500 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600 disabled:opacity-50"
              >
                {reportSubmitting ? "Submitting…" : "Submit Report"}
              </button>
              <button
                onClick={() => setShowReportModal(false)}
                className="w-full rounded-full border border-gray-200 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
