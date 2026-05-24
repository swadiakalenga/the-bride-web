"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import Card from "../../components/ui/Card";
import Spinner from "../../components/ui/Spinner";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/ui/EmptyState";
import BottomNav from "../../components/ui/BottomNav";
import MediaGrid from "../../components/feed/MediaGrid";
import MediaPlayer from "../../components/feed/MediaPlayer";
import type { Post, Comment } from "../../../lib/types";
import { checkContentGuidelines } from "../../../lib/types";
import { createNotification } from "../../../lib/notificationPush";
import LinkifiedText from "../../components/ui/LinkifiedText";
import LinkPreviewCard from "../../components/feed/LinkPreviewCard";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import type { ConfirmDialogOptions } from "../../components/ui/ConfirmDialog";

type LikeRow = {
  post_id: string;
  user_id: string;
};

export default function PostPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const postId = params.id as string;
  const targetCommentId = searchParams.get("commentId");

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uiMessage, setUiMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);

  const [likeCount, setLikeCount] = useState(0);
  const [userLiked, setUserLiked] = useState(false);
  const [viewCount, setViewCount] = useState(0);

  const [commentInput, setCommentInput] = useState("");
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [showReplyBox, setShowReplyBox] = useState<Record<string, boolean>>({});
  const tempIdCounter = useRef(0);

  const [editingPost, setEditingPost] = useState(false);
  const [editPostContent, setEditPostContent] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogOptions | null>(null);

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    if (!loading && targetCommentId) {
      setTimeout(() => {
        const el = document.getElementById(`comment-${targetCommentId}`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, [loading, targetCommentId]);

  async function loadPage() {
    setLoading(true);
    setUiMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    setCurrentUserId(user?.id || null);

    if (user?.id) {
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      setCurrentUserName(myProfile?.full_name || null);
    }

    const { data: postData, error: postError } = await supabase
      .from("posts")
      .select("*")
      .eq("id", postId)
      .single();

    if (postError || !postData) {
      setPost(null);
      setUiMessage(postError?.message || "This post could not be loaded.");
      setLoading(false);
      return;
    }

    setPost(postData);

    if (user) {
      await supabase
        .from("post_views")
        .upsert({ post_id: postId, user_id: user.id }, { ignoreDuplicates: true });
    }

    const { data: viewsData } = await supabase
      .from("post_views")
      .select("post_id")
      .eq("post_id", postId);
    setViewCount((viewsData || []).length);

    const { data: likesData, error: likesError } = await supabase
      .from("likes")
      .select("post_id, user_id")
      .eq("post_id", postId);

    if (!likesError) {
      const likeRows = (likesData || []) as LikeRow[];
      setLikeCount(likeRows.length);
      setUserLiked(!!likeRows.find((row) => row.user_id === user?.id));
    }

    const { data: commentsData, error: commentsError } = await supabase
      .from("comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (commentsError) {
      setUiMessage(`Comments could not be loaded: ${commentsError.message}`);
    } else {
      setComments(commentsData || []);
    }

    setLoading(false);
  }

  const toggleLike = async () => {
    if (!currentUserId) {
      router.push("/login");
      return;
    }

    const previousLiked = userLiked;
    const previousCount = likeCount;
    setUserLiked(!previousLiked);
    setLikeCount(Math.max(0, previousCount + (previousLiked ? -1 : 1)));

    const { error } = previousLiked
      ? await supabase
          .from("likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", currentUserId)
      : await supabase
          .from("likes")
          .insert([{ post_id: postId, user_id: currentUserId }]);

    if (error) {
      setUserLiked(previousLiked);
      setLikeCount(previousCount);
      setUiMessage(`Like failed: ${error.message}`);
    }
  };

  const addComment = async () => {
    if (!currentUserId) {
      router.push("/login");
      return;
    }

    const text = commentInput.trim();
    if (!text) return;

    const guidelines = checkContentGuidelines(text);
    if (!guidelines.ok) {
      setUiMessage(guidelines.message);
      return;
    }

    const tempId = `temp-${++tempIdCounter.current}`;
    const authorName = currentUserName || "Unknown";
    const optimistic: Comment = {
      id: tempId,
      post_id: postId,
      user_id: currentUserId,
      parent_comment_id: null,
      author_name: authorName,
      content: text,
      created_at: new Date().toISOString(),
    };

    setCommentInput("");
    setComments((prev) => [...prev, optimistic]);

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
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setCommentInput(text);
      setUiMessage(`Comment failed: ${error.message}`);
      return;
    }

    if (inserted) {
      setComments((prev) => prev.map((c) => (c.id === tempId ? inserted : c)));

      // Notify the post owner about the new comment
      if (post && post.user_id !== currentUserId) {
        void createNotification({
          recipientUserId: post.user_id,
          actorUserId: currentUserId!,
          type: "comment",
          postId,
          commentId: inserted.id,
        });
      }
    }
  };

  const addReply = async (parentCommentId: string) => {
    if (!currentUserId) {
      router.push("/login");
      return;
    }

    const text = replyInputs[parentCommentId]?.trim();
    if (!text) return;

    const guidelines = checkContentGuidelines(text);
    if (!guidelines.ok) {
      setUiMessage(guidelines.message);
      return;
    }

    const tempId = `temp-${++tempIdCounter.current}`;
    const authorName = currentUserName || "Unknown";
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
    setComments((prev) => [...prev, optimistic]);

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
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setReplyInputs((prev) => ({ ...prev, [parentCommentId]: text }));
      setUiMessage(`Reply failed: ${error.message}`);
      return;
    }

    if (inserted) {
      setComments((prev) => prev.map((c) => (c.id === tempId ? inserted : c)));

      // Notify the parent comment's author about the reply
      const parentComment = comments.find((c) => c.id === parentCommentId);
      if (parentComment && parentComment.user_id !== currentUserId) {
        void createNotification({
          recipientUserId: parentComment.user_id,
          actorUserId: currentUserId!,
          type: "reply",
          postId,
          commentId: inserted.id,
        });
      }
    }
  };

  const handleSavePostEdit = async () => {
    const text = editPostContent.trim();
    if (!text || !post) { setEditingPost(false); return; }

    const guidelines = checkContentGuidelines(text);
    if (!guidelines.ok) { setUiMessage(guidelines.message); return; }

    const { error } = await supabase
      .from("posts")
      .update({ content: text })
      .eq("id", postId);

    if (error) {
      setUiMessage(`Edit failed: ${error.message}`);
      return;
    }

    setPost({ ...post, content: text });
    setEditingPost(false);
  };

  const handleDeletePost = () => {
    if (!post) return;
    setConfirmDialog({
      title: "Delete post",
      message: "This cannot be undone. Delete this post?",
      confirmLabel: "Delete",
      onConfirm: async () => {
        setConfirmDialog(null);
        const { error } = await supabase.from("posts").delete().eq("id", postId);
        if (error) { setUiMessage(`Delete failed: ${error.message}`); return; }
        router.push("/feed");
      },
    });
  };

  const topLevelComments = useMemo(
    () => comments.filter((comment) => !comment.parent_comment_id),
    [comments]
  );

  const getReplies = (parentCommentId: string) =>
    comments.filter((comment) => comment.parent_comment_id === parentCommentId);

  const goToUser = (userId: string) => {
    router.push(`/user/${userId}`);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-10">
        <Spinner />
      </main>
    );
  }

  if (!post) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-6 pb-24">
        <div className="mx-auto w-full max-w-lg space-y-4">
          <Button onClick={() => router.back()} variant="secondary">
            Back
          </Button>
          {uiMessage && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {uiMessage}
            </div>
          )}
          <EmptyState
            title="Post not found"
            description="This post may have been deleted or is no longer available."
          />
        </div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 pb-24 pt-4">
      <div className="mx-auto w-full max-w-lg space-y-4">
        <div className="sticky top-0 z-30 -mx-4 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-lg items-center justify-between">
            <button
              onClick={() => router.back()}
              className="flex h-9 items-center gap-1 rounded-full px-2 text-sm font-semibold text-gray-600 hover:bg-gray-100"
            >
              <span aria-hidden="true">←</span>
              Back
            </button>
            <button
              onClick={() => router.push("/feed")}
              className="rounded-full bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
            >
              Feed
            </button>
          </div>
        </div>

        {uiMessage && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {uiMessage}
          </div>
        )}

        <Card>
          <div className="flex items-start justify-between gap-2">
            <button
              onClick={() => goToUser(post.user_id)}
              className="text-left font-semibold text-gray-900 hover:underline"
            >
              {post.author_name || "Unknown"}
            </button>
            {currentUserId === post.user_id && !editingPost && (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => { setEditingPost(true); setEditPostContent(post.content); }}
                  className="rounded-full px-2.5 py-1 text-xs font-semibold text-gray-400 hover:bg-gray-100 hover:text-brand-500"
                >
                  Edit
                </button>
                <button
                  onClick={handleDeletePost}
                  className="rounded-full px-2.5 py-1 text-xs font-semibold text-gray-400 hover:bg-gray-100 hover:text-red-500"
                >
                  Delete
                </button>
              </div>
            )}
          </div>

          {editingPost ? (
            <div className="mt-2 space-y-2">
              <textarea
                autoFocus
                value={editPostContent}
                onChange={(e) => setEditPostContent(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-amber-400 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSavePostEdit}
                  className="rounded-full bg-amber-400 px-4 py-1.5 text-xs font-bold text-white hover:bg-amber-500"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingPost(false)}
                  className="rounded-full bg-gray-100 px-4 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            post.content && (
              <LinkifiedText
                text={post.content}
                className="mt-2 whitespace-pre-wrap text-[15px] leading-6 text-gray-800"
              />
            )
          )}

          {post.media_type === "photo" && post.media_urls && post.media_urls.length > 0 && (
            <MediaGrid urls={post.media_urls} />
          )}
          {post.media_type === "audio" && post.media_urls?.[0] && (
            <MediaPlayer url={post.media_urls[0]} type="audio" />
          )}
          {post.media_type === "video" && post.media_urls?.[0] && (
            <MediaPlayer url={post.media_urls[0]} type="video" />
          )}

          {post.link_url && (
            <LinkPreviewCard
              url={post.link_url}
              title={post.link_title}
              description={post.link_description}
              image={post.link_image_url}
              siteName={post.link_site_name}
              domain={post.link_domain}
            />
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-500">
            <span>
              {new Date(post.created_at).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleLike}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                  userLiked
                    ? "bg-amber-50 text-amber-600"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {userLiked ? "Liked" : "Like"} ({likeCount})
              </button>
              <span className="text-xs text-gray-400">
                {viewCount} {post.media_type === "video" ? "watch" : "view"}
                {viewCount !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Comments</h2>
            <span className="text-xs text-gray-400">
              {topLevelComments.length} thread{topLevelComments.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="mt-3 flex gap-2">
            <input
              type="text"
              placeholder="Write a comment..."
              value={commentInput}
              onChange={(event) => setCommentInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void addComment();
              }}
              className="min-w-0 flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm outline-none focus:border-amber-300 focus:bg-white"
            />
            <Button onClick={addComment} size="sm">
              Send
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            {topLevelComments.length === 0 ? (
              <p className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                No comments yet. Start the conversation with grace.
              </p>
            ) : (
              topLevelComments.map((comment) => {
                const replies = getReplies(comment.id);
                const isTarget = targetCommentId === comment.id;

                return (
                  <div
                    key={comment.id}
                    id={`comment-${comment.id}`}
                    className={`rounded-xl p-3 transition ${
                      isTarget ? "bg-amber-50 ring-2 ring-amber-300" : "bg-gray-50"
                    }`}
                  >
                    <button
                      onClick={() => goToUser(comment.user_id)}
                      className="text-left text-sm font-semibold text-gray-900 hover:underline"
                    >
                      {comment.author_name || "Unknown"}
                    </button>

                    <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-gray-800">
                      {comment.content}
                    </p>

                    <div className="mt-2 flex items-center justify-between gap-2 text-xs text-gray-500">
                      <span>{new Date(comment.created_at).toLocaleString()}</span>
                      <button
                        onClick={() =>
                          setShowReplyBox((prev) => ({
                            ...prev,
                            [comment.id]: !prev[comment.id],
                          }))
                        }
                        className="font-semibold text-brand-500 hover:text-brand-600"
                      >
                        Reply {replies.length > 0 ? `(${replies.length})` : ""}
                      </button>
                    </div>

                    {showReplyBox[comment.id] && (
                      <div className="mt-3 flex gap-2">
                        <input
                          type="text"
                          placeholder="Write a reply..."
                          value={replyInputs[comment.id] || ""}
                          onChange={(event) =>
                            setReplyInputs((prev) => ({
                              ...prev,
                              [comment.id]: event.target.value,
                            }))
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") void addReply(comment.id);
                          }}
                          className="min-w-0 flex-1 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-300"
                        />
                        <Button onClick={() => addReply(comment.id)} size="sm">
                          Reply
                        </Button>
                      </div>
                    )}

                    {replies.length > 0 && (
                      <div className="mt-3 space-y-2 border-l-2 border-gray-200 pl-3">
                        {replies.map((reply) => {
                          const isReplyTarget = targetCommentId === reply.id;

                          return (
                            <div
                              key={reply.id}
                              id={`comment-${reply.id}`}
                              className={`rounded-xl p-3 transition ${
                                isReplyTarget
                                  ? "bg-amber-50 ring-2 ring-amber-300"
                                  : "bg-white"
                              }`}
                            >
                              <button
                                onClick={() => goToUser(reply.user_id)}
                                className="text-left text-xs font-semibold text-gray-900 hover:underline"
                              >
                                {reply.author_name || "Unknown"}
                              </button>
                              <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-gray-800">
                                {reply.content}
                              </p>
                              <p className="mt-1 text-xs text-gray-500">
                                {new Date(reply.created_at).toLocaleString()}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      <BottomNav />

      <ConfirmDialog
        open={!!confirmDialog}
        title={confirmDialog?.title}
        message={confirmDialog?.message ?? ""}
        confirmLabel={confirmDialog?.confirmLabel}
        destructive={confirmDialog?.destructive ?? true}
        onConfirm={() => confirmDialog?.onConfirm()}
        onCancel={() => setConfirmDialog(null)}
      />
    </main>
  );
}
