"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import Spinner from "../components/ui/Spinner";
import MediaGrid from "../components/feed/MediaGrid";
import MediaPlayer from "../components/feed/MediaPlayer";
import Logo from "../components/ui/Logo";
import BottomNav from "../components/ui/BottomNav";
import LeftSidebar from "../components/feed/LeftSidebar";
import RightSidebar from "../components/feed/RightSidebar";
import EmojiPicker from "../components/ui/EmojiPicker";
import type { Post, Comment, Profile } from "../../lib/types";
import { checkContentGuidelines } from "../../lib/types";

type CommentMap = Record<string, Comment[]>;
type CommentInputMap = Record<string, string>;
type BooleanMap = Record<string, boolean>;
type ReplyInputMap = Record<string, string>;
type CommentLikeMap = Record<string, number>;
type CommentUserLikeMap = Record<string, boolean>;
type ProfileMap = Record<string, Profile>;
type LikeMap = Record<string, number>;
type UserLikeMap = Record<string, boolean>;

export default function Feed() {
  const router = useRouter();
  const [feedType, setFeedType] = useState<"people" | "church">("people");

  const [posts, setPosts] = useState<Post[]>([]);
  const [content, setContent] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [selectedAudio, setSelectedAudio] = useState<File | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [mediaError, setMediaError] = useState("");
  const [showMediaMenu, setShowMediaMenu] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [showGoLive, setShowGoLive] = useState(false);
  const [liveStreams, setLiveStreams] = useState<{ id: string; title: string; church_name: string | null; church_avatar: string | null; viewer_count: number }[]>([]);
  const [myActiveStreamId, setMyActiveStreamId] = useState<string | null>(null);
  const [liveTitle, setLiveTitle] = useState("");
  const [startingLive, setStartingLive] = useState(false);
  const [postStatus, setPostStatus] = useState<"idle" | "uploading" | "publishing" | "failed">("idle");
  const [pageLoading, setPageLoading] = useState(true);
  const [showAiMenu, setShowAiMenu] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [uiMessage, setUiMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});

  const [profilesById, setProfilesById] = useState<ProfileMap>({});

  const [likeCounts, setLikeCounts] = useState<LikeMap>({});
  const [userLikes, setUserLikes] = useState<UserLikeMap>({});

  const [commentsByPost, setCommentsByPost] = useState<CommentMap>({});
  const [commentInputs, setCommentInputs] = useState<CommentInputMap>({});
  const [showCommentBox, setShowCommentBox] = useState<BooleanMap>({});
  const [showAllComments, setShowAllComments] = useState<BooleanMap>({});

  const [replyInputs, setReplyInputs] = useState<ReplyInputMap>({});
  const [showReplyBox, setShowReplyBox] = useState<BooleanMap>({});

  const [commentLikeCounts, setCommentLikeCounts] = useState<CommentLikeMap>({});
  const [commentUserLikes, setCommentUserLikes] = useState<CommentUserLikeMap>({});

  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Tagging
  const [tagSearch, setTagSearch] = useState("");
  const [tagResults, setTagResults] = useState<{ id: string; full_name: string | null }[]>([]);
  const [taggedUsers, setTaggedUsers] = useState<{ id: string; full_name: string | null }[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const viewedPostsRef = useRef(new Set<string>());
  const tempIdCounter = useRef(0);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (!showMediaMenu) return;
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-media-menu]")) return;
      setShowMediaMenu(false);
    };
    const timer = setTimeout(() => {
      document.addEventListener("click", close);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", close);
    };
  }, [showMediaMenu]);

  useEffect(() => {
    if (!showAiMenu) return;
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-ai-menu]")) return;
      setShowAiMenu(false);
    };
    const timer = setTimeout(() => {
      document.addEventListener("click", close);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", close);
    };
  }, [showAiMenu]);

  useEffect(() => {
    if (currentUserId) {
      loadUnreadNotificationCount();
    }
  }, [currentUserId]);

  useEffect(() => {
    if (currentUserId !== null) {
      loadPosts();
      if (feedType === "church") loadLiveStreams();
      else setLiveStreams([]);
    }
  }, [currentUserId, feedType, myProfile?.church_id, myProfile?.role]);

  // Poll live streams every 15s when on church feed so new streams appear automatically
  useEffect(() => {
    if (!currentUserId || feedType !== "church") return;
    const interval = setInterval(() => loadLiveStreams(), 15000);
    return () => clearInterval(interval);
  }, [currentUserId, feedType, myProfile?.church_id]);

  useEffect(() => {
    if (!currentUserId || posts.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const postId = (entry.target as HTMLElement).dataset.postId;
            if (postId && !viewedPostsRef.current.has(postId)) {
              viewedPostsRef.current.add(postId);
              supabase.auth.getSession().then(({ data: { session } }) => {
                if (!session?.user) return;
                supabase
                  .from("post_views")
                  .upsert({ post_id: postId, user_id: session.user.id }, { ignoreDuplicates: true })
                  .then(() => {
                    // Refresh count from DB after successful insert
                    supabase
                      .from("post_views")
                      .select("post_id")
                      .eq("post_id", postId)
                      .then(({ data }) => {
                        if (data) {
                          setViewCounts((prev) => ({ ...prev, [postId]: data.length }));
                        }
                      });
                  });
              });
              // Optimistic +1 while DB records
              setViewCounts((prev) => ({ ...prev, [postId]: (prev[postId] || 0) + 1 }));
            }
          }
        });
      },
      { threshold: 0.1 }
    );

    const elements = document.querySelectorAll("[data-post-id]");
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [posts, currentUserId]);

   useEffect(() => {
  if (!currentUserId) return;

  const channel = supabase
    .channel(`notifications-feed-${currentUserId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `recipient_user_id=eq.${currentUserId}`,
      },
      () => {
        loadUnreadNotificationCount();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [currentUserId]);

  async function loadUnreadNotificationCount() {
    if (!currentUserId) {
      setUnreadNotificationCount(0);
      return;
    }

    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("recipient_user_id", currentUserId)
      .eq("is_read", false);

    if (error) return;

    setUnreadNotificationCount(count || 0);
  }

  const clearFeedState = () => {
    setPosts([]);
    setCommentsByPost({});
    setLikeCounts({});
    setUserLikes({});
    setProfilesById({});
    setCommentLikeCounts({});
    setCommentUserLikes({});
  };

  const setErrorMessage = (message: string) => {
    setUiMessage(message);
  };

  async function loadCurrentUser() {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id || null;
    setCurrentUserId(uid);

    if (!uid) {
      setPageLoading(false);
      return;
    }

    const { data: me, error } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, role, church_id")
      .eq("id", uid)
      .maybeSingle();

    if (error) {
      setErrorMessage(`Could not load your profile: ${error.message}`);
    }

    setMyProfile(me || null);

    // Church admins default to church feed and check for active stream
    if (me?.role === "church_admin" && me?.church_id) {
      setFeedType("church");
      const { data: activeStream } = await supabase
        .from("live_streams")
        .select("id")
        .eq("broadcaster_id", uid)
        .eq("status", "live")
        .maybeSingle();

      if (activeStream) {
        // Auto-end stale stream — if user is here (not on live page), stream should be ended
        await supabase
          .from("live_streams")
          .update({ status: "ended", ended_at: new Date().toISOString(), viewer_count: 0 })
          .eq("id", activeStream.id);
        setMyActiveStreamId(null);
      } else {
        setMyActiveStreamId(null);
      }
    }
  }

  const loadProfiles = async (postList: Post[], commentGroups?: CommentMap) => {
    const ids = new Set<string>();

    postList.forEach((post) => ids.add(post.user_id));

    const commentMap = commentGroups || commentsByPost;
    Object.values(commentMap).forEach((comments) => {
      comments.forEach((comment) => ids.add(comment.user_id));
    });

    if (ids.size === 0) {
      setProfilesById({});
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, role, church_id")
      .in("id", Array.from(ids));

    if (error) {
      setErrorMessage(`Load profiles failed: ${error.message}`);
      return;
    }

    const map: ProfileMap = {};
    (data || []).forEach((profile) => {
      map[profile.id] = profile;
    });

    setProfilesById(map);
  };

  async function loadPosts() {
    if (!currentUserId) return;

    setPageLoading(true);
    setUiMessage("");

    let postList: Post[] = [];

    if (feedType === "people") {
      const { data: followsData, error: followError } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", currentUserId);

      if (followError) {
        setErrorMessage(`Follow load failed: ${followError.message}`);
        setPageLoading(false);
        return;
      }

      const followingIds = (followsData || []).map((f) => f.following_id);
      const allowedIds = [...followingIds, currentUserId];

      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .in("user_id", allowedIds)
        .is("church_id", null)
        .order("created_at", { ascending: false });

      if (error) {
        setErrorMessage(`Load posts failed: ${error.message}`);
        setPageLoading(false);
        return;
      }

      postList = data || [];
    } else {
      const { data: churchFollowData, error: churchFollowError } = await supabase
        .from("church_follows")
        .select("church_id")
        .eq("user_id", currentUserId);

      if (churchFollowError) {
        setErrorMessage(`Church follows load failed: ${churchFollowError.message}`);
        setPageLoading(false);
        return;
      }

      const churchIds = (churchFollowData || []).map((row) => row.church_id);

      if (myProfile?.church_id) {
        churchIds.push(myProfile.church_id);
      }

      const uniqueChurchIds = Array.from(new Set(churchIds.filter(Boolean)));

      if (uniqueChurchIds.length === 0) {
        clearFeedState();
        setPageLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .in("church_id", uniqueChurchIds)
        .order("created_at", { ascending: false });

      if (error) {
        setErrorMessage(`Load church posts failed: ${error.message}`);
        setPageLoading(false);
        return;
      }

      postList = data || [];
    }

    setPosts(postList);

    const comments = await loadComments(postList);

    await Promise.all([
      loadLikes(postList),
      loadProfiles(postList, comments),
      loadViewCounts(postList.map((p) => p.id)),
    ]);
    setPageLoading(false);
  }

  const loadLikes = async (postList: Post[]) => {
    const ids = postList.map((p) => p.id);

    if (ids.length === 0) {
      setLikeCounts({});
      setUserLikes({});
      return;
    }

    const { data, error } = await supabase
      .from("likes")
      .select("post_id, user_id")
      .in("post_id", ids);

    if (error) {
      setErrorMessage(`Load likes failed: ${error.message}`);
      return;
    }

    const counts: LikeMap = {};
    const userMap: UserLikeMap = {};

    data?.forEach((l) => {
      counts[l.post_id] = (counts[l.post_id] || 0) + 1;
      if (l.user_id === currentUserId) userMap[l.post_id] = true;
    });

    setLikeCounts(counts);
    setUserLikes(userMap);
  };

  const loadComments = async (postList: Post[]) => {
    const ids = postList.map((p) => p.id);

    if (ids.length === 0) {
      setCommentsByPost({});
      setCommentLikeCounts({});
      setCommentUserLikes({});
      return {};
    }

    const { data, error } = await supabase
      .from("comments")
      .select("*")
      .in("post_id", ids)
      .order("created_at", { ascending: true });

    if (error) {
      setErrorMessage(`Load comments failed: ${error.message}`);
      return {};
    }

    const grouped: CommentMap = {};

    data?.forEach((c) => {
      if (!grouped[c.post_id]) grouped[c.post_id] = [];
      grouped[c.post_id].push(c);
    });

    setCommentsByPost(grouped);

    const commentIds = (data || []).map((c) => c.id);

    if (commentIds.length === 0) {
      setCommentLikeCounts({});
      setCommentUserLikes({});
      return grouped;
    }

    const { data: likesData, error: likesError } = await supabase
      .from("comment_likes")
      .select("comment_id, user_id")
      .in("comment_id", commentIds);

    if (likesError) {
      setErrorMessage(`Load comment likes failed: ${likesError.message}`);
      return grouped;
    }

    const counts: CommentLikeMap = {};
    const userMap: CommentUserLikeMap = {};

    likesData?.forEach((like) => {
      counts[like.comment_id] = (counts[like.comment_id] || 0) + 1;
      if (like.user_id === currentUserId) userMap[like.comment_id] = true;
    });

    setCommentLikeCounts(counts);
    setCommentUserLikes(userMap);

    return grouped;
  };

  const loadViewCounts = async (postIds: string[]) => {
    if (postIds.length === 0) return;
    const { data, error } = await supabase
      .from("post_views")
      .select("post_id")
      .in("post_id", postIds);
    if (error) return; // table may not exist yet — keep existing counts
    const counts: Record<string, number> = {};
    (data || []).forEach((row) => {
      counts[row.post_id] = (counts[row.post_id] || 0) + 1;
    });
    // Merge with existing counts (don't wipe local session increments)
    setViewCounts((prev) => ({ ...prev, ...counts }));
  };

  // Church accounts can upload up to 5 minutes, personal accounts up to 45 seconds
  const validateVideoDuration = (file: File): Promise<boolean> =>
    new Promise((resolve) => {
      const maxDuration = myProfile?.role === "church_admin" ? 300 : 45;
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve(video.duration <= maxDuration);
      };
      video.onerror = () => resolve(false);
      video.src = URL.createObjectURL(file);
    });

  const uploadSingleFile = async (
    userId: string,
    file: File,
    folder: string
  ): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${folder}/${userId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("media").upload(path, file);
    if (error) {
      setErrorMessage(`Upload failed: ${error.message}`);
      return null;
    }
    const { data } = supabase.storage.from("media").getPublicUrl(path);
    return data.publicUrl;
  };

  const uploadImages = async (userId: string): Promise<string[] | null> => {
    if (selectedImages.length === 0) return [];

    const results = await Promise.all(
      selectedImages.map(async (file, i) => {
        const ext = file.name.split(".").pop();
        const path = `posts/${userId}-${Date.now()}-${i}.${ext}`;

        const { error } = await supabase.storage
          .from("media")
          .upload(path, file);

        if (error) return { error: error.message, url: null };

        const { data } = supabase.storage.from("media").getPublicUrl(path);
        return { error: null, url: data.publicUrl };
      })
    );

    const failed = results.find((r) => r.error);
    if (failed) {
      setErrorMessage(`Image upload failed: ${failed.error}`);
      return null;
    }

    return results.map((r) => r.url as string);
  };

  async function loadLiveStreams() {
    if (!currentUserId) return;

    // Get church IDs the user follows (plus own church if church admin)
    const { data: churchFollows } = await supabase
      .from("church_follows")
      .select("church_id")
      .eq("user_id", currentUserId);

    const churchIds = (churchFollows || []).map((f) => f.church_id);
    if (myProfile?.church_id) churchIds.push(myProfile.church_id);

    const uniqueIds = [...new Set(churchIds.filter(Boolean))];
    if (uniqueIds.length === 0) { setLiveStreams([]); return; }

    const { data: streams } = await supabase
      .from("live_streams")
      .select("id, title, church_id, viewer_count")
      .in("church_id", uniqueIds)
      .eq("status", "live")
      .order("started_at", { ascending: false });

    if (!streams || streams.length === 0) { setLiveStreams([]); return; }

    // Get church names
    const { data: churches } = await supabase
      .from("churches")
      .select("id, name")
      .in("id", streams.map((s) => s.church_id));

    const churchMap: Record<string, string> = {};
    (churches || []).forEach((c) => { churchMap[c.id] = c.name; });

    // Get church admin avatars
    const { data: adminProfiles } = await supabase
      .from("profiles")
      .select("church_id, avatar_url")
      .in("church_id", streams.map((s) => s.church_id))
      .eq("role", "church_admin");

    const avatarMap: Record<string, string | null> = {};
    (adminProfiles || []).forEach((p) => {
      if (p.church_id) avatarMap[p.church_id] = p.avatar_url;
    });

    setLiveStreams(streams.map((s) => ({
      id: s.id,
      title: s.title,
      church_name: churchMap[s.church_id] || null,
      church_avatar: avatarMap[s.church_id] || null,
      viewer_count: s.viewer_count || 0,
    })));
  }

  const startLiveStream = async () => {
    if (!liveTitle.trim() || !myProfile?.church_id || !currentUserId) return;
    setStartingLive(true);

    const { data, error } = await supabase
      .from("live_streams")
      .insert([{
        church_id: myProfile.church_id,
        broadcaster_id: currentUserId,
        title: liveTitle.trim(),
        status: "live",
      }])
      .select("id")
      .single();

    setStartingLive(false);
    if (error || !data) {
      setErrorMessage(`Could not start stream: ${error?.message || "Unknown error"}`);
      return;
    }
    setShowGoLive(false);
    setLiveTitle("");
    setMyActiveStreamId(data.id);
    router.push(`/live/${data.id}`);
  };

  const createPost = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setErrorMessage("Login required.");
      return;
    }

    if (!content.trim() && selectedImages.length === 0 && !selectedAudio && !selectedVideo) return;

    // Community guidelines check
    const guidelinesCheck = checkContentGuidelines(content);
    if (!guidelinesCheck.ok) {
      setErrorMessage(guidelinesCheck.message);
      return;
    }

    if (!myProfile) {
      setErrorMessage("Profile not loaded yet.");
      return;
    }

    // Strict feed separation
    if (myProfile.role === "church_admin" && feedType === "people") {
      setErrorMessage("Church accounts can only post in the Church feed.");
      return;
    }
    if (myProfile.role !== "church_admin" && feedType === "church") {
      setErrorMessage("Only church accounts can post in the Church feed.");
      return;
    }
    if (myProfile.role === "church_admin" && !myProfile.church_id) {
      setErrorMessage("Your account is not linked to a church yet.");
      return;
    }

    const hasMedia = selectedImages.length > 0 || !!selectedAudio || !!selectedVideo;
    setPostStatus(hasMedia ? "uploading" : "publishing");
    setUiMessage("");

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, church_id, role")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      setPostStatus("failed");
      setErrorMessage("Could not load your profile.");
      return;
    }

    let finalMediaUrls: string[] = [];
    let finalMediaType: string | null = null;

    if (selectedImages.length > 0) {
      const urls = await uploadImages(data.user.id);
      if (urls === null) { setPostStatus("failed"); return; }
      finalMediaUrls = urls;
      finalMediaType = "photo";
    } else if (selectedAudio) {
      const url = await uploadSingleFile(data.user.id, selectedAudio, "audio");
      if (!url) { setPostStatus("failed"); return; }
      finalMediaUrls = [url];
      finalMediaType = "audio";
    } else if (selectedVideo) {
      const url = await uploadSingleFile(data.user.id, selectedVideo, "video");
      if (!url) { setPostStatus("failed"); return; }
      finalMediaUrls = [url];
      finalMediaType = "video";
    }

    setPostStatus("publishing");

    const postPayload: Record<string, unknown> = {
      user_id: data.user.id,
      church_id: feedType === "church" ? profile.church_id : null,
      content: content.trim(),
      author_name: profile.full_name || "Unknown",
      media_urls: finalMediaUrls.length > 0 ? finalMediaUrls : null,
      media_type: finalMediaType,
    };

    // Only include tagged_user_ids if users were tagged (column may not exist yet)
    if (taggedUsers.length > 0) {
      postPayload.tagged_user_ids = taggedUsers.map((u) => u.id);
    }

    const { error } = await supabase.from("posts").insert([postPayload]);

    if (error) {
      setPostStatus("failed");
      setErrorMessage(`Post failed: ${error.message}`);
      return;
    }

    setPostStatus("idle");
    setUiMessage("");
    setContent("");
    setSelectedImages([]);
    setSelectedAudio(null);
    setSelectedVideo(null);
    setMediaError("");
    setShowCompose(false);
    setTaggedUsers([]);
    setTagSearch("");
    setTagResults([]);
    setAiResult(null);
    setAiError(null);

    if (fileInputRef.current) fileInputRef.current.value = "";
    if (audioInputRef.current) audioInputRef.current.value = "";
    if (videoInputRef.current) videoInputRef.current.value = "";

    loadPosts();
    loadUnreadNotificationCount();
  };

  const requestAiRewrite = async (action: string) => {
    if (!content.trim()) return;
    setShowAiMenu(false);
    setAiLoading(true);
    setAiError(null);
    setAiResult(null);

    try {
      const res = await fetch("/api/ai/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: content, action }),
      });
      const json = await res.json() as { result?: string; error?: string };
      if (json.error) {
        setAiError(json.error);
      } else {
        setAiResult(json.result ?? null);
      }
    } catch {
      setAiError("AI request failed. Please try again.");
    } finally {
      setAiLoading(false);
    }
  };

  const toggleLike = async (postId: string) => {
    if (!currentUserId) return;

    const wasLiked = userLikes[postId];

    // Optimistic update — no full reload, instant feedback
    setUserLikes((prev) => ({ ...prev, [postId]: !wasLiked }));
    setLikeCounts((prev) => ({
      ...prev,
      [postId]: Math.max(0, (prev[postId] || 0) + (wasLiked ? -1 : 1)),
    }));

    const { error } = wasLiked
      ? await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", currentUserId)
      : await supabase.from("likes").insert([{ post_id: postId, user_id: currentUserId }]);

    if (error) {
      // Revert on failure
      setUserLikes((prev) => ({ ...prev, [postId]: wasLiked }));
      setLikeCounts((prev) => ({
        ...prev,
        [postId]: Math.max(0, (prev[postId] || 0) + (wasLiked ? 1 : -1)),
      }));
    }

    loadUnreadNotificationCount();
  };

  const toggleCommentLike = async (commentId: string) => {
    if (!currentUserId) return;

    const wasLiked = commentUserLikes[commentId];

    // Optimistic update
    setCommentUserLikes((prev) => ({ ...prev, [commentId]: !wasLiked }));
    setCommentLikeCounts((prev) => ({
      ...prev,
      [commentId]: Math.max(0, (prev[commentId] || 0) + (wasLiked ? -1 : 1)),
    }));

    const { error } = wasLiked
      ? await supabase.from("comment_likes").delete().eq("comment_id", commentId).eq("user_id", currentUserId)
      : await supabase.from("comment_likes").insert([{ comment_id: commentId, user_id: currentUserId }]);

    if (error) {
      // Revert on failure
      setCommentUserLikes((prev) => ({ ...prev, [commentId]: wasLiked }));
      setCommentLikeCounts((prev) => ({
        ...prev,
        [commentId]: Math.max(0, (prev[commentId] || 0) + (wasLiked ? 1 : -1)),
      }));
    }
  };

  const deletePost = async (postId: string) => {
    if (!currentUserId) return;

    const confirmed = window.confirm("Are you sure you want to delete this post?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("posts")
      .delete()
      .eq("id", postId)
      .eq("user_id", currentUserId);

    if (error) {
      setErrorMessage(`Delete failed: ${error.message}`);
      return;
    }

    loadPosts();
  };

  const startEditing = (post: Post) => {
    setEditingPostId(post.id);
    setEditContent(post.content || "");
  };

  const cancelEditing = () => {
    setEditingPostId(null);
    setEditContent("");
  };

  const saveEdit = async (postId: string) => {
    if (!currentUserId || !editContent.trim()) return;

    const guidelinesCheck = checkContentGuidelines(editContent);
    if (!guidelinesCheck.ok) {
      setErrorMessage(guidelinesCheck.message);
      return;
    }

    const { error } = await supabase
      .from("posts")
      .update({ content: editContent.trim() })
      .eq("id", postId)
      .eq("user_id", currentUserId);

    if (error) {
      setErrorMessage(`Edit failed: ${error.message}`);
      return;
    }

    setEditingPostId(null);
    setEditContent("");
    loadPosts();
  };

  const updateCommentInput = (postId: string, value: string) => {
    setCommentInputs((prev) => ({
      ...prev,
      [postId]: value,
    }));
  };

  const addComment = async (postId: string) => {
    if (!currentUserId) return;

    const text = commentInputs[postId]?.trim();
    if (!text) return;

    const guidelinesCheck = checkContentGuidelines(text);
    if (!guidelinesCheck.ok) {
      setErrorMessage(guidelinesCheck.message);
      return;
    }

    const tempId = `temp-${++tempIdCounter.current}`;
    const authorName = myProfile?.full_name || "Unknown";
    const optimistic: Comment = {
      id: tempId,
      post_id: postId,
      user_id: currentUserId,
      parent_comment_id: null,
      author_name: authorName,
      content: text,
      created_at: new Date().toISOString(),
    };

    setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
    setShowCommentBox((prev) => ({ ...prev, [postId]: true }));
    setCommentsByPost((prev) => ({
      ...prev,
      [postId]: [...(prev[postId] || []), optimistic],
    }));

    const { data: inserted, error } = await supabase
      .from("comments")
      .insert([{
        post_id: postId,
        user_id: currentUserId,
        parent_comment_id: null,
        content: text,
        author_name: authorName,
      }])
      .select()
      .single();

    if (error) {
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).filter((c) => c.id !== tempId),
      }));
      setCommentInputs((prev) => ({ ...prev, [postId]: text }));
      setErrorMessage(`Comment failed: ${error.message}`);
      return;
    }

    if (inserted) {
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).map((c) => (c.id === tempId ? inserted : c)),
      }));
    }

    loadUnreadNotificationCount();
  };

  const addReply = async (postId: string, parentCommentId: string) => {
    if (!currentUserId) return;

    const text = replyInputs[parentCommentId]?.trim();
    if (!text) return;

    const guidelinesCheck = checkContentGuidelines(text);
    if (!guidelinesCheck.ok) {
      setErrorMessage(guidelinesCheck.message);
      return;
    }

    const tempId = `temp-${++tempIdCounter.current}`;
    const authorName = myProfile?.full_name || "Unknown";
    const optimistic: Comment = {
      id: tempId,
      post_id: postId,
      user_id: currentUserId,
      parent_comment_id: parentCommentId,
      author_name: authorName,
      content: text,
      created_at: new Date().toISOString(),
    };

    setReplyInputs((prev) => ({ ...prev, [parentCommentId]: "" }));
    setShowReplyBox((prev) => ({ ...prev, [parentCommentId]: true }));
    setCommentsByPost((prev) => ({
      ...prev,
      [postId]: [...(prev[postId] || []), optimistic],
    }));

    const { data: inserted, error } = await supabase
      .from("comments")
      .insert([{
        post_id: postId,
        user_id: currentUserId,
        parent_comment_id: parentCommentId,
        content: text,
        author_name: authorName,
      }])
      .select()
      .single();

    if (error) {
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).filter((c) => c.id !== tempId),
      }));
      setReplyInputs((prev) => ({ ...prev, [parentCommentId]: text }));
      setErrorMessage(`Reply failed: ${error.message}`);
      return;
    }

    if (inserted) {
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).map((c) => (c.id === tempId ? inserted : c)),
      }));
    }

    loadUnreadNotificationCount();
  };

  const deleteComment = async (commentId: string) => {
    if (!currentUserId) return;

    const confirmed = window.confirm("Delete this comment?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("comments")
      .delete()
      .eq("id", commentId)
      .eq("user_id", currentUserId);

    if (error) {
      setErrorMessage(`Delete comment failed: ${error.message}`);
      return;
    }

    loadPosts();
  };

  const toggleCommentBox = (postId: string) => {
    setShowCommentBox((prev) => ({
      ...prev,
      [postId]: !prev[postId],
    }));

    setTimeout(() => {
      const input = document.getElementById(`comment-${postId}`) as HTMLInputElement | null;
      input?.focus();
    }, 100);
  };

  const toggleReplyBox = (commentId: string) => {
    setShowReplyBox((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));

    setTimeout(() => {
      const input = document.getElementById(`reply-${commentId}`) as HTMLInputElement | null;
      input?.focus();
    }, 100);
  };

  const toggleShowAllComments = (postId: string) => {
    setShowAllComments((prev) => ({
      ...prev,
      [postId]: !prev[postId],
    }));
  };

  const getTopLevelComments = (postId: string) => {
    const allComments = commentsByPost[postId] || [];
    return allComments.filter((c) => !c.parent_comment_id);
  };

  const getReplies = (postId: string, parentCommentId: string) => {
    const allComments = commentsByPost[postId] || [];
    return allComments.filter((c) => c.parent_comment_id === parentCommentId);
  };

  const getVisibleTopLevelComments = (postId: string) => {
    const topLevel = getTopLevelComments(postId);
    if (showAllComments[postId]) return topLevel;
    return topLevel.slice(0, 1);
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const searchTagUsers = async (q: string) => {
    setTagSearch(q);
    if (!q.trim() || !currentUserId) { setTagResults([]); return; }
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name")
      .ilike("full_name", `%${q.trim()}%`)
      .neq("id", currentUserId)
      .limit(5);
    setTagResults(data || []);
  };

  const addTaggedUser = (user: { id: string; full_name: string | null }) => {
    if (!taggedUsers.find((t) => t.id === user.id)) {
      setTaggedUsers((prev) => [...prev, user]);
    }
    const name = user.full_name || "User";
    const textarea = textareaRef.current;
    if (textarea) {
      const cursor = textarea.selectionStart ?? content.length;
      setContent((prev) => {
        const before = prev.slice(0, cursor).replace(/@\w*$/, `@${name} `);
        return before + prev.slice(cursor);
      });
    }
    setTagSearch("");
    setTagResults([]);
  };

  const removeTaggedUser = (userId: string) => {
    setTaggedUsers((prev) => prev.filter((t) => t.id !== userId));
  };

  const renderAvatar = (userId: string, fallbackName?: string | null, size = "h-10 w-10") => {
    const profile = profilesById[userId];
    const avatarUrl = profile?.avatar_url;
    const name = profile?.full_name || fallbackName || "Unknown";

    if (avatarUrl) {
      return (
        <img
          src={avatarUrl}
          alt={name}
          className={`${size} rounded-full object-cover border`}
        />
      );
    }

    return (
      <div
        className={`${size} flex items-center justify-center rounded-full border bg-gray-200 text-sm font-bold text-gray-600`}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    );
  };

  const myName = myProfile?.full_name || "My Profile";
  const myAvatar = myProfile?.avatar_url;

  return (
    <main className="min-h-screen bg-gray-50 pb-20 lg:pb-0">
      {/* ── TOP HEADER ── */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg lg:max-w-7xl items-center justify-between px-4 py-3">
          {/* Left: avatar */}
          <button onClick={() => router.push("/profile")} className="flex-shrink-0">
            {myAvatar ? (
              <img src={myAvatar} alt={myName} className="h-9 w-9 rounded-full border-2 border-amber-400 object-cover" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-amber-400 bg-amber-50 text-sm font-bold text-amber-600">
                {myName.charAt(0).toUpperCase()}
              </div>
            )}
          </button>

          {/* Center: Logo */}
          <Logo size="md" />

          {/* Right: icons */}
          <div className="flex items-center gap-1">
            {/* Go Live — church only */}
            {myProfile?.role === "church_admin" && myProfile?.church_id && (
              myActiveStreamId ? (
                <button
                  type="button"
                  onClick={() => router.push(`/live/${myActiveStreamId}`)}
                  className="flex h-8 items-center gap-1.5 rounded-full bg-red-500 px-3 text-xs font-bold text-white"
                >
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  Live
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowGoLive(true)}
                  className="flex h-8 items-center gap-1.5 rounded-full bg-blue-500 px-3 text-xs font-bold text-white"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
                  Go Live
                </button>
              )
            )}

            <button
              onClick={() => router.push("/messages")}
              className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
              aria-label="Messages"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </button>

            <button
              onClick={() => router.push("/search")}
              className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
              aria-label="Search"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
            </button>
          </div>
        </div>

        {/* Feed type tabs */}
        <div className="mx-auto flex max-w-lg lg:max-w-7xl border-t border-gray-100">
          <button
            onClick={() => setFeedType("people")}
            className={`flex-1 py-3 text-sm font-semibold transition ${
              feedType === "people"
                ? "border-b-2 border-amber-400 text-amber-500"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            People
          </button>
          <button
            onClick={() => setFeedType("church")}
            className={`flex-1 py-3 text-sm font-semibold transition ${
              feedType === "church"
                ? "border-b-2 border-blue-500 text-blue-500"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Church
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 pt-2">
        <div className="grid grid-cols-12 gap-6">

          {/* Left sidebar — desktop only */}
          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-[88px]">
              <LeftSidebar
                myProfile={myProfile}
                myAvatar={myAvatar}
                unreadCount={unreadNotificationCount}
                onCompose={() => setShowCompose(true)}
              />
            </div>
          </aside>

          {/* Center feed */}
          <section className="col-span-12 lg:col-span-6">
        {uiMessage && (
          <div className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {uiMessage}
          </div>
        )}

        {/* ── LIVE STREAMS (church feed only) ── */}
        {feedType === "church" && liveStreams.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              <span className="text-sm font-bold text-red-600 uppercase tracking-wide">Live Now</span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
              {liveStreams.map((stream) => (
                <button
                  key={stream.id}
                  onClick={() => router.push(`/live/${stream.id}`)}
                  className="relative flex-shrink-0 w-44 overflow-hidden rounded-2xl bg-gray-900 shadow-lg active:scale-95 transition-transform"
                  style={{ height: "120px" }}
                >
                  {/* Dark gradient background */}
                  <div className="absolute inset-0 bg-gradient-to-br from-red-900/60 to-gray-900" />

                  {/* Church avatar */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    {stream.church_avatar ? (
                      <img src={stream.church_avatar} alt="" className="h-8 w-8 rounded-full border-2 border-red-500 object-cover" />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-red-500 bg-gray-700 text-xs font-bold text-white">
                        {(stream.church_name || "C").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* LIVE badge */}
                  <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                    <span className="text-[10px] font-bold text-white">LIVE</span>
                  </div>

                  {/* Bottom info */}
                  <div className="absolute bottom-0 left-0 right-0 px-3 py-2" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)" }}>
                    <p className="truncate text-xs font-bold text-white">{stream.church_name}</p>
                    <p className="truncate text-[10px] text-gray-300">{stream.title}</p>
                    <p className="text-[10px] text-gray-400">👁 {stream.viewer_count} watching</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── GO LIVE MODAL ── */}
        {showGoLive && (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
            <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Go Live</h2>
                  <p className="text-xs text-gray-400">Your followers will be notified</p>
                </div>
                <button type="button" onClick={() => { setShowGoLive(false); setLiveTitle(""); }} className="text-gray-400 hover:text-gray-700">✕</button>
              </div>

              <div className="mb-2 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2.5">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
                <span className="text-sm font-semibold text-red-700">Live Video</span>
              </div>

              <input
                type="text"
                value={liveTitle}
                onChange={(e) => setLiveTitle(e.target.value)}
                placeholder="What's the stream about? (e.g. Sunday Service)"
                className="mt-3 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm outline-none focus:border-red-400 focus:bg-white"
                autoFocus
              />

              <button
                onClick={startLiveStream}
                disabled={startingLive || !liveTitle.trim()}
                className="mt-4 w-full rounded-xl bg-red-600 py-3 font-bold text-white disabled:bg-red-300"
              >
                {startingLive ? "Starting..." : "Start Live Stream"}
              </button>
            </div>
          </div>
        )}

        {/* ── COMPOSE MODAL ── */}
        {showCompose && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 pb-32 pt-16">
            <div className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl max-h-[calc(100dvh-8rem)]">
              {/* Header */}
              <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
                <h2 className="text-lg font-bold text-gray-900">Create Post</h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowCompose(false);
                    setContent("");
                    setSelectedImages([]);
                    setSelectedAudio(null);
                    setSelectedVideo(null);
                    setMediaError("");
                    setAiResult(null);
                    setAiError(null);
                    setShowAiMenu(false);
                    setPostStatus("idle");
                    setTaggedUsers([]);
                    setTagSearch("");
                    setTagResults([]);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-5 py-4">
                  {/* Textarea with inline @mention autocomplete */}
                  <div className="relative">
                    <textarea
                      ref={textareaRef}
                      placeholder="What's on your mind? Type @name to tag someone."
                      value={content}
                      onChange={(e) => {
                        setContent(e.target.value);
                        const cursor = e.target.selectionStart ?? e.target.value.length;
                        const textBeforeCursor = e.target.value.slice(0, cursor);
                        const match = textBeforeCursor.match(/@(\w*)$/);
                        if (match) {
                          searchTagUsers(match[1]);
                        } else {
                          setTagSearch("");
                          setTagResults([]);
                        }
                      }}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-amber-300 focus:bg-white"
                      rows={4}
                      autoFocus
                    />
                    {tagResults.length > 0 && (
                      <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-xl border bg-white shadow-lg">
                        {tagResults.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => addTaggedUser(user)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                          >
                            <span className="font-medium">@{user.full_name || "User"}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* File inputs moved outside modal — see below */}

                  {/* Media previews */}
                  {mediaError && <p className="mt-2 text-sm text-red-500">{mediaError}</p>}

                  {selectedImages.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedImages.map((file, i) => (
                        <div key={i} className="relative">
                          <img src={URL.createObjectURL(file)} alt={file.name} className="h-20 w-20 rounded-lg border object-cover" />
                          <button type="button" onClick={() => setSelectedImages((prev) => prev.filter((_, idx) => idx !== i))}
                            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">×</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedAudio && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-700">
                      <span>🎵</span>
                      <span className="flex-1 truncate">{selectedAudio.name}</span>
                      <button type="button" onClick={() => setSelectedAudio(null)} className="text-red-500">×</button>
                    </div>
                  )}

                  {selectedVideo && (
                    <div className="mt-3 overflow-hidden rounded-lg border">
                      <video src={URL.createObjectURL(selectedVideo)} controls className="w-full max-h-48 bg-black" />
                      <div className="flex items-center justify-between bg-gray-50 px-3 py-1 text-xs text-gray-500">
                        <span className="truncate">{selectedVideo.name}</span>
                        <button type="button" onClick={() => setSelectedVideo(null)} className="ml-2 text-red-500">Remove</button>
                      </div>
                    </div>
                  )}

                  {/* Posting status */}
                  {postStatus === "uploading" && (
                    <p className="mt-3 text-xs text-blue-500">Uploading media…</p>
                  )}
                  {postStatus === "publishing" && (
                    <p className="mt-3 text-xs text-blue-500">Publishing post…</p>
                  )}
                  {postStatus === "failed" && (
                    <p className="mt-3 text-xs text-red-500">Post failed — your content is saved above, try again.</p>
                  )}

                  {/* AI feedback */}
                  {aiLoading && (
                    <div className="mt-3 rounded-xl bg-purple-50 px-3 py-2 text-sm text-purple-600">AI is thinking…</div>
                  )}
                  {aiError && (
                    <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{aiError}</div>
                  )}
                  {aiResult && (
                    <div className="mt-3 rounded-xl border border-purple-100 bg-purple-50 p-3">
                      <p className="mb-1 text-xs font-semibold text-purple-700">AI suggestion — tap Use to apply</p>
                      <p className="whitespace-pre-wrap text-sm text-gray-800">{aiResult}</p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => { setContent(aiResult); setAiResult(null); }}
                          className="rounded-full bg-purple-500 px-3 py-1 text-xs font-semibold text-white hover:bg-purple-600"
                        >
                          Use
                        </button>
                        <button
                          type="button"
                          onClick={() => setAiResult(null)}
                          className="rounded-full border px-3 py-1 text-xs font-semibold text-gray-500 hover:bg-gray-50"
                        >
                          Discard
                        </button>
                      </div>
                    </div>
                  )}

              </div>

              {/* Footer — inside the card, never near BottomNav */}
              <div className="flex-shrink-0 border-t border-gray-100 bg-white px-5 py-3">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <button type="button" onClick={() => setShowMediaMenu((v) => !v)}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 bg-white text-2xl font-light text-gray-700 shadow-sm hover:bg-gray-50">
                      +
                    </button>
                    {showMediaMenu && (
                      <div data-media-menu className="absolute bottom-12 left-0 z-10 w-52 rounded-2xl border border-gray-100 bg-white p-1.5 shadow-xl">
                        <button type="button" onClick={() => { setShowMediaMenu(false); setTimeout(() => fileInputRef.current?.click(), 10); }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-amber-50 transition">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-500">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                          </span>
                          Photo
                        </button>
                        <button type="button" onClick={() => { setShowMediaMenu(false); setTimeout(() => audioInputRef.current?.click(), 10); }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-amber-50 transition">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-500">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                          </span>
                          Audio
                        </button>
                        <button type="button" onClick={() => { setShowMediaMenu(false); setTimeout(() => videoInputRef.current?.click(), 10); }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-amber-50 transition">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-500">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                          </span>
                          <span className="flex flex-col items-start">
                            Video
                            <span className="text-[10px] font-normal text-gray-400">{myProfile?.role === "church_admin" ? "max 5 min" : "max 45s"}</span>
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker((v) => !v)}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 bg-white text-xl shadow-sm hover:bg-gray-50"
                    >
                      😊
                    </button>
                    {showEmojiPicker && (
                      <EmojiPicker
                        onSelect={(emoji) => setContent((prev) => prev + emoji)}
                        onClose={() => setShowEmojiPicker(false)}
                      />
                    )}
                  </div>
                  <div className="relative" data-ai-menu>
                    <button
                      type="button"
                      onClick={() => setShowAiMenu((v) => !v)}
                      disabled={!content.trim() || aiLoading}
                      className="flex h-10 items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 text-xs font-semibold text-purple-600 shadow-sm hover:bg-purple-100 disabled:opacity-40"
                    >
                      ✨ AI
                    </button>
                    {showAiMenu && (
                      <div data-ai-menu className="absolute bottom-12 left-0 z-10 w-52 rounded-2xl border border-gray-100 bg-white p-1.5 shadow-xl">
                        {[
                          ["improve", "✍️ Improve writing"],
                          ["shorter", "✂️ Make shorter"],
                          ["encouraging", "🙏 More encouraging"],
                          ["french", "🇫🇷 Translate to French"],
                          ["english", "🇬🇧 Translate to English"],
                          ["announcement", "📢 Church announcement"],
                        ].map(([action, label]) => (
                          <button
                            key={action}
                            type="button"
                            onClick={() => requestAiRewrite(action)}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-purple-50 transition"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={createPost}
                  disabled={postStatus !== "idle"}
                  className="mt-3 h-12 w-full rounded-full bg-amber-400 text-base font-bold text-white shadow-sm disabled:opacity-50"
                >
                  {postStatus === "uploading" ? "Uploading…" : postStatus === "publishing" ? "Publishing…" : "Post"}
                </button>
              </div>
            </div>
          </div>
        )}

        {!pageLoading && feedType === "church" && posts.length === 0 && (
          <div className="mt-6">
            <EmptyState
              title="No church posts yet"
              description="Follow a church from search or a user profile, then church posts will appear here."
            />
          </div>
        )}

        {!pageLoading && feedType === "people" && posts.length === 0 && (
          <div className="mt-6">
            <EmptyState
              title="No people posts yet"
              description="Follow some people or create your first post to start building your feed."
            />
          </div>
        )}

        {pageLoading ? (
          <Spinner />
        ) : (
          <div className="mt-6 space-y-4">
            {posts.map((post) => {
              const allTopLevelComments = getTopLevelComments(post.id);
              const commentCount = allTopLevelComments.length;
              const visibleComments = getVisibleTopLevelComments(post.id);

              return (
                <Card key={post.id} data-post-id={post.id}>
                  <div className="flex items-start gap-3">
                    {renderAvatar(post.user_id, post.author_name, "h-11 w-11")}

                    <div className="flex-1">
                      <button onClick={() => router.push(`/user/${post.user_id}`)} className="font-semibold hover:underline text-left">
                        {post.author_name || "Unknown"}
                      </button>

                      {editingPostId === post.id ? (
                        <div className="mt-2">
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full rounded-lg border p-3"
                            rows={3}
                          />

                          <div className="mt-2 flex gap-3 text-sm">
                            <button onClick={() => saveEdit(post.id)} className="text-green-600 hover:underline">
                              Save
                            </button>
                            <button onClick={cancelEditing} className="text-gray-500 hover:underline">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {post.content && <p className="mt-1 whitespace-pre-wrap">{post.content}</p>}
                          {post.tagged_user_ids && post.tagged_user_ids.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {post.tagged_user_ids.map((uid) => {
                                const p = profilesById[uid];
                                return (
                                  <button
                                    key={uid}
                                    onClick={() => router.push(`/user/${uid}`)}
                                    className="text-xs font-medium text-blue-500 hover:underline"
                                  >
                                    @{p?.full_name || "user"}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          {post.media_type === "photo" && post.media_urls && post.media_urls.length > 0 && (
                            <MediaGrid urls={post.media_urls as string[]} />
                          )}
                          {post.media_type === "audio" && post.media_urls?.[0] && (
                            <MediaPlayer url={post.media_urls[0]} type="audio" />
                          )}
                          {post.media_type === "video" && post.media_urls?.[0] && (
                            <MediaPlayer url={post.media_urls[0]} type="video" />
                          )}
                        </>
                      )}

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-1 text-xs text-gray-400">
                        <span className="whitespace-nowrap">
                          {new Date(post.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          {(viewCounts[post.id] || 0) > 0 && (
                            <span className="ml-2 text-gray-300">· {viewCounts[post.id]} {post.media_type === "video" ? "watch" : "view"}{(viewCounts[post.id] || 0) !== 1 ? "s" : ""}</span>
                          )}
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => toggleLike(post.id)}
                            className={`flex items-center gap-1 rounded-full px-2.5 py-1 transition ${
                              userLikes[post.id]
                                ? "bg-amber-50 text-amber-500"
                                : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            }`}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill={userLikes[post.id] ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                            </svg>
                            <span>{likeCounts[post.id] || 0}</span>
                          </button>

                          <button
                            onClick={() => toggleCommentBox(post.id)}
                            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-gray-400 transition hover:bg-gray-100 hover:text-blue-500"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                            </svg>
                            <span>{commentCount}</span>
                          </button>

                          {feedType === "people" && currentUserId === post.user_id && editingPostId !== post.id && (
                            <>
                              <button onClick={() => startEditing(post)} className="rounded-full px-2.5 py-1 text-gray-400 hover:bg-gray-100 hover:text-blue-500">
                                Edit
                              </button>
                              <button onClick={() => deletePost(post.id)} className="rounded-full px-2.5 py-1 text-gray-400 hover:bg-gray-100 hover:text-red-500">
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {commentCount > 0 && (
                        <div className="mt-4 border-t border-gray-200 pt-3">
                          <div className="space-y-3">
                            {visibleComments.map((comment) => {
                              const replies = getReplies(post.id, comment.id);

                              return (
                                <div key={comment.id} className="rounded-lg bg-gray-50 p-3">
                                  <div className="flex items-start gap-3">
                                    {renderAvatar(comment.user_id, comment.author_name, "h-9 w-9")}

                                    <div className="flex-1">
                                      <button onClick={() => router.push(`/user/${comment.user_id}`)} className="text-sm font-semibold hover:underline text-left">
                                        {comment.author_name || "Unknown"}
                                      </button>

                                      <p className="mt-1 text-sm">{comment.content}</p>

                                      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                                        <span>{new Date(comment.created_at).toLocaleString()}</span>

                                        <div className="flex flex-wrap gap-2">
                                          <button
                                            onClick={() => toggleCommentLike(comment.id)}
                                            className={commentUserLikes[comment.id] ? "text-amber-500" : "hover:text-amber-400"}
                                          >
                                            {commentUserLikes[comment.id] ? "♥" : "♡"} {commentLikeCounts[comment.id] || 0}
                                          </button>

                                          <button onClick={() => toggleReplyBox(comment.id)} className="hover:text-blue-500">
                                            Reply {replies.length > 0 && `(${replies.length})`}
                                          </button>

                                          {currentUserId === comment.user_id && (
                                            <button onClick={() => deleteComment(comment.id)} className="text-red-400 hover:text-red-600">
                                              Delete
                                            </button>
                                          )}
                                        </div>
                                      </div>

                                      {replies.length > 0 && (
                                        <div className="mt-3 space-y-2 border-l-2 border-gray-200 pl-3">
                                          {replies.map((reply) => (
                                            <div key={reply.id} className="rounded-lg bg-white p-2">
                                              <div className="flex items-start gap-2">
                                                {renderAvatar(reply.user_id, reply.author_name, "h-8 w-8")}

                                                <div className="flex-1">
                                                  <button onClick={() => router.push(`/user/${reply.user_id}`)} className="text-xs font-semibold hover:underline text-left">
                                                    {reply.author_name || "Unknown"}
                                                  </button>

                                                  <p className="mt-1 text-sm">{reply.content}</p>

                                                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                                                    <span>{new Date(reply.created_at).toLocaleString()}</span>

                                                    <div className="flex flex-wrap gap-2">
                                                      <button
                                                        onClick={() => toggleCommentLike(reply.id)}
                                                        className={commentUserLikes[reply.id] ? "text-amber-500" : "hover:text-amber-400"}
                                                      >
                                                        {commentUserLikes[reply.id] ? "♥" : "♡"} {commentLikeCounts[reply.id] || 0}
                                                      </button>

                                                      {currentUserId === reply.user_id && (
                                                        <button onClick={() => deleteComment(reply.id)} className="text-red-400 hover:text-red-600">
                                                          Delete
                                                        </button>
                                                      )}
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      {showReplyBox[comment.id] && (
                                        <div className="mt-2 flex gap-2">
                                          <input
                                            id={`reply-${comment.id}`}
                                            type="text"
                                            placeholder="Write a reply..."
                                            value={replyInputs[comment.id] || ""}
                                            onChange={(e) =>
                                              setReplyInputs((prev) => ({
                                                ...prev,
                                                [comment.id]: e.target.value,
                                              }))
                                            }
                                            className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm outline-none focus:border-amber-300"
                                          />
                                          <button
                                            onClick={() => addReply(post.id, comment.id)}
                                            className="rounded-full bg-amber-400 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500"
                                          >
                                            Reply
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {commentCount > 1 && (
                            <button
                              onClick={() => toggleShowAllComments(post.id)}
                              className="mt-2 text-xs font-medium text-blue-500 hover:text-blue-600"
                            >
                              {showAllComments[post.id] ? "Show less" : `View all ${commentCount} comments`}
                            </button>
                          )}
                        </div>
                      )}

                      {showCommentBox[post.id] && (
                        <div className="mt-3 flex gap-2">
                          <input
                            id={`comment-${post.id}`}
                            type="text"
                            placeholder="Add a comment..."
                            value={commentInputs[post.id] || ""}
                            onChange={(e) => updateCommentInput(post.id, e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") addComment(post.id); }}
                            className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm outline-none focus:border-amber-300 focus:bg-white"
                          />
                          <button
                            onClick={() => addComment(post.id)}
                            className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500"
                          >
                            Post
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
        </section>

          {/* Right sidebar — desktop only */}
          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-[88px]">
              <RightSidebar currentUserId={currentUserId} liveStreams={liveStreams} />
            </div>
          </aside>

        </div>
      </div>

      {/* File inputs — always in DOM, off-screen so mobile browsers allow .click() */}
      <div className="fixed -left-[9999px] -top-[9999px] opacity-0 pointer-events-none" aria-hidden="true">
        <input ref={fileInputRef} type="file" accept="image/*" multiple tabIndex={-1}
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            setSelectedImages((prev) => [...prev, ...files]);
            setSelectedAudio(null); setSelectedVideo(null); setMediaError("");
            e.target.value = "";
          }}
        />
        <input ref={audioInputRef} type="file" accept="audio/*" tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0] || null;
            setSelectedAudio(file); setSelectedImages([]); setSelectedVideo(null); setMediaError("");
            e.target.value = "";
          }}
        />
        <input ref={videoInputRef} type="file" accept="video/*" tabIndex={-1}
          onChange={async (e) => {
            const file = e.target.files?.[0] || null;
            e.target.value = "";
            if (!file) return;
            const valid = await validateVideoDuration(file);
            if (!valid) {
              const limit = myProfile?.role === "church_admin" ? "5 minutes" : "45 seconds";
              setMediaError(`Video must be ${limit} or shorter.`);
              return;
            }
            setSelectedVideo(file); setSelectedImages([]); setSelectedAudio(null); setMediaError("");
          }}
        />
      </div>

      <div className="lg:hidden">
        <BottomNav
          unreadCount={unreadNotificationCount}
          onCompose={() => setShowCompose(true)}
        />
      </div>
    </main>
  );
}