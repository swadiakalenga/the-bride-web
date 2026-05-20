"use client";

import { useState } from "react";
import type { Post } from "../../../lib/types";
import MediaGrid from "./MediaGrid";
import MediaPlayer from "./MediaPlayer";
import ExpandableText from "../ui/ExpandableText";

type PostCardProps = {
  post: Post;
  currentUserId: string | null;
  likeCounts: Record<string, number>;
  userLikes: Record<string, boolean>;
  onLike: (postId: string) => void;
  shareCounts?: Record<string, number>;
  userShares?: Record<string, boolean>;
  onShare?: (postId: string) => void;
  commentCount?: number;
  onEdit?: (updatedPost: Post) => Promise<void>;
  onDelete?: (postId: string) => void;
  isOwner?: boolean;
  lang?: "fr" | "en";
  sharedByName?: string | null;
};

export default function PostCard({
  post,
  currentUserId,
  likeCounts,
  userLikes,
  onLike,
  shareCounts,
  userShares,
  onShare,
  commentCount,
  onEdit,
  onDelete,
  isOwner,
  lang = "en",
  sharedByName,
}: PostCardProps) {
  const mediaUrls = post.media_urls ?? [];
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content || "");
  const [saving, setSaving] = useState(false);

  const L = {
    like: lang === "fr" ? "J'aime" : "Like",
    unlike: lang === "fr" ? "Je n'aime plus" : "Unlike",
    share: lang === "fr" ? "Partager" : "Share",
    shared: lang === "fr" ? "Partagé" : "Shared",
    edit: lang === "fr" ? "Modifier" : "Edit",
    delete: lang === "fr" ? "Supprimer" : "Delete",
    cancel: lang === "fr" ? "Annuler" : "Cancel",
    save: lang === "fr" ? "Sauvegarder" : "Save",
    sharedBy: lang === "fr" ? "Partagé par" : "Shared by",
  };

  const handleSaveEdit = async () => {
    if (!onEdit) return;
    setSaving(true);
    await onEdit({ ...post, content: editContent });
    setSaving(false);
    setEditing(false);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditContent(post.content || "");
  };

  const shareCount = shareCounts?.[post.id] ?? 0;
  const hasShared = userShares?.[post.id] ?? false;
  const hasLiked = userLikes[post.id] ?? false;

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      {/* Shared-by label */}
      {sharedByName && (
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2.5 text-xs text-gray-500">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          <span>{L.sharedBy} <strong>{sharedByName}</strong></span>
        </div>
      )}

      <div className="flex items-start gap-3 p-4">
        {/* Avatar */}
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 font-bold text-gray-600 text-sm">
          {(post.author_name || "U").charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 leading-tight">{post.author_name || "Unknown"}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(post.created_at).toLocaleString(lang === "fr" ? "fr-FR" : "en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>

          {/* Edit mode */}
          {editing ? (
            <div className="mt-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 resize-none"
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={handleCancelEdit}
                  className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  {L.cancel}
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="rounded-full bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {saving ? "…" : L.save}
                </button>
              </div>
            </div>
          ) : (
            <>
              {post.content && (
                <ExpandableText
                  text={post.content}
                  lang={lang}
                  className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-gray-800"
                />
              )}

              {post.media_type === "photo" && mediaUrls.length > 0 && (
                <MediaGrid urls={mediaUrls} />
              )}

              {post.media_type === "audio" && mediaUrls?.[0] && (
                <MediaPlayer url={mediaUrls[0]} type="audio" />
              )}

              {post.media_type === "video" && mediaUrls?.[0] && (
                <MediaPlayer url={mediaUrls[0]} type="video" />
              )}
            </>
          )}

          {/* Action bar */}
          {!editing && (
            <div className="mt-3 flex flex-wrap items-center gap-0.5 text-xs text-gray-400">
              {/* Like */}
              <button
                onClick={() => onLike(post.id)}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 transition ${
                  hasLiked ? "bg-red-50 text-red-500" : "hover:bg-gray-100 hover:text-gray-600"
                }`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill={hasLiked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                </svg>
                <span>{hasLiked ? L.unlike : L.like} ({likeCounts[post.id] ?? 0})</span>
              </button>

              {/* Comment count (read-only) */}
              {typeof commentCount === "number" && (
                <span className="flex items-center gap-1 px-2.5 py-1">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                  <span>{commentCount}</span>
                </span>
              )}

              {/* Share */}
              {onShare && (
                <button
                  onClick={() => onShare(post.id)}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 transition ${
                    hasShared ? "bg-brand-50 text-brand-600" : "hover:bg-gray-100 hover:text-gray-600"
                  }`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                    <polyline points="16 6 12 2 8 6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                  <span>
                    {hasShared ? L.shared : L.share}
                    {shareCount > 0 && ` (${shareCount})`}
                  </span>
                </button>
              )}

              {/* Owner actions */}
              {isOwner && currentUserId === post.user_id && (
                <>
                  {onEdit && (
                    <button
                      onClick={() => setEditing(true)}
                      className="rounded-full px-2.5 py-1 hover:bg-gray-100 hover:text-brand-600"
                    >
                      {L.edit}
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => onDelete(post.id)}
                      className="rounded-full px-2.5 py-1 hover:bg-red-50 hover:text-red-500"
                    >
                      {L.delete}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
