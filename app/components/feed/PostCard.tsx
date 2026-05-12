import type { Post } from "../../../lib/types";
import MediaGrid from "./MediaGrid";

type PostCardProps = {
  post: Post;
  currentUserId: string | null;
  likeCounts: Record<string, number>;
  userLikes: Record<string, boolean>;
  onLike: (postId: string) => void;
};

export default function PostCard({
  post,
  currentUserId,
  likeCounts,
  userLikes,
  onLike,
}: PostCardProps) {
  const mediaUrls = post.media_urls ?? [];

  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 font-bold">
          {(post.author_name || "U").charAt(0)}
        </div>

        <div className="flex-1">
          <p className="font-semibold">{post.author_name || "Unknown"}</p>

          {post.content && <p className="mt-1">{post.content}</p>}

          {post.media_type === "photo" && mediaUrls.length > 0 && (
            <MediaGrid urls={mediaUrls} />
          )}

          <div className="mt-2 flex justify-between text-sm text-gray-500">
            <span>{new Date(post.created_at).toLocaleString()}</span>

            <button
              onClick={() => onLike(post.id)}
              className="hover:underline"
            >
              {userLikes[post.id] ? "Unlike" : "Like"} (
              {likeCounts[post.id] || 0})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}