"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { useLanguage } from "../../../lib/useLanguage";

type PostRow = {
  id: string;
  content: string;
  user_id: string;
  author_name: string | null;
  church_id: string | null;
  media_urls: string[] | null;
  created_at: string;
  like_count: number;
  comment_count: number;
  report_count: number;
};

export default function AdminPostsPage() {
  const { t } = useLanguage();
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error: rpcError } = await supabase.rpc("admin_list_posts", {
      p_limit: 100,
      p_offset: 0,
    });
    if (rpcError) setError(rpcError.message);
    else setPosts((data as PostRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const deletePost = async (id: string) => {
    setDeletingId(id);
    const { error: rpcError } = await supabase.rpc("admin_delete_post", { p_post_id: id });
    if (rpcError) setError(rpcError.message);
    else setPosts((prev) => prev.filter((p) => p.id !== id));
    setDeletingId(null);
    setConfirmId(null);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">{t("admin_posts_title")}</h1>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <p className="text-gray-400">{t("admin_posts_none")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3">Contenu</th>
                <th className="px-4 py-3">{t("admin_posts_author")}</th>
                <th className="px-4 py-3">{t("admin_posts_likes")}</th>
                <th className="px-4 py-3">{t("admin_posts_comments")}</th>
                <th className="px-4 py-3 text-red-400">{t("admin_posts_reports")}</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {posts.map((p) => (
                <tr key={p.id} className={`hover:bg-gray-50 ${p.report_count > 0 ? "bg-red-50/30" : ""}`}>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="truncate text-gray-700">{p.content}</p>
                    {p.media_urls && p.media_urls.length > 0 && (
                      <span className="text-xs text-gray-400">{p.media_urls.length} média(s)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.author_name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{p.like_count}</td>
                  <td className="px-4 py-3 text-gray-500">{p.comment_count}</td>
                  <td className={`px-4 py-3 font-semibold ${p.report_count > 0 ? "text-red-600" : "text-gray-400"}`}>
                    {p.report_count}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {confirmId === p.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          disabled={deletingId === p.id}
                          onClick={() => deletePost(p.id)}
                          className="rounded-lg bg-red-500 px-2 py-1 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                        >
                          {t("common_confirm")}
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          {t("common_cancel")}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmId(p.id)}
                        className="text-xs font-medium text-red-500 hover:underline"
                      >
                        {t("admin_posts_delete")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
