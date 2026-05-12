"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import BottomNav from "../../../components/ui/BottomNav";
import type { Devotional } from "../../../../lib/types";

export default function DevotionalsPage() {
  const params = useParams();
  const router = useRouter();
  const churchId = params.id as string;

  const [devotionals, setDevotionals] = useState<Devotional[]>([]);
  const [churchName, setChurchName] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Create devotional form
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [bibleVerse, setBibleVerse] = useState("");
  const [publishDate, setPublishDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadPage();
  }, [churchId]);

  async function loadPage() {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    const me = authData.user?.id;
    if (!me) { router.push("/login"); return; }
    setCurrentUserId(me);

    const { data: church } = await supabase
      .from("churches")
      .select("name")
      .eq("id", churchId)
      .maybeSingle();
    setChurchName(church?.name || "Church");

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, church_id")
      .eq("id", me)
      .maybeSingle();
    setIsAdmin(profile?.role === "church_admin" && profile?.church_id === churchId);

    const { data: devotionalData } = await supabase
      .from("devotionals")
      .select("*")
      .eq("church_id", churchId)
      .order("publish_date", { ascending: false });

    setDevotionals(devotionalData || []);
    setLoading(false);
  }

  const submitDevotional = async () => {
    if (!currentUserId || !title.trim() || !content.trim()) return;
    setSubmitting(true);

    await supabase.from("devotionals").insert([{
      church_id: churchId,
      title: title.trim(),
      content: content.trim(),
      bible_verse: bibleVerse.trim() || null,
      publish_date: publishDate || new Date().toISOString().split("T")[0],
    }]);

    setTitle("");
    setContent("");
    setBibleVerse("");
    setPublishDate("");
    setShowForm(false);
    setSubmitting(false);
    loadPage();
  };

  const deleteDevotional = async (id: string) => {
    if (!confirm("Delete this devotional?")) return;
    await supabase.from("devotionals").delete().eq("id", id);
    setDevotionals((prev) => prev.filter((d) => d.id !== id));
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const todayDevotional = devotionals.find((d) => d.publish_date === todayStr);

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Devotionals</h1>
              <p className="text-xs text-gray-400">{churchName}</p>
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500"
            >
              {showForm ? "Cancel" : "+ New"}
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg px-4 pt-4">
        {/* Create devotional form (admin only) */}
        {showForm && (
          <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">New Devotional</h2>
            <div className="space-y-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Devotional title *"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-amber-300 focus:bg-white"
              />
              <input
                value={bibleVerse}
                onChange={(e) => setBibleVerse(e.target.value)}
                placeholder='Bible verse (e.g., "John 3:16")'
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-amber-300 focus:bg-white"
              />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Devotional content *"
                rows={6}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-amber-300 focus:bg-white"
              />
              <div>
                <label className="mb-1 block text-xs text-gray-500">Publish date</label>
                <input
                  type="date"
                  value={publishDate}
                  onChange={(e) => setPublishDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-amber-300 focus:bg-white"
                />
                <p className="mt-1 text-xs text-gray-400">Leave blank to publish today</p>
              </div>
              <button
                onClick={submitDevotional}
                disabled={submitting || !title.trim() || !content.trim()}
                className="w-full rounded-full bg-amber-400 py-3 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {submitting ? "Publishing..." : "Publish Devotional"}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="mt-8 flex justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" /></div>
        ) : devotionals.length === 0 ? (
          <div className="mt-8 text-center">
            <p className="text-4xl mb-2">📖</p>
            <p className="font-semibold text-gray-700">No devotionals yet</p>
            <p className="text-sm text-gray-400 mt-1">
              {isAdmin ? "Share the first devotional with your church." : "Check back for daily devotionals from your church."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Today's devotional highlight */}
            {todayDevotional && (
              <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100/50 p-5 shadow-sm border border-amber-200/50">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">✨</span>
                  <span className="text-xs font-bold text-amber-600 uppercase tracking-wide">Today&apos;s Devotional</span>
                </div>
                <h3 className="text-lg font-bold text-gray-900">{todayDevotional.title}</h3>
                {todayDevotional.bible_verse && (
                  <p className="mt-1 text-sm font-medium text-amber-700 italic">{todayDevotional.bible_verse}</p>
                )}
                <p className="mt-3 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {todayDevotional.content}
                </p>
              </div>
            )}

            {/* All devotionals */}
            <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide pt-2">
              {todayDevotional ? "All Devotionals" : "Devotionals"}
            </h2>

            {devotionals.map((devotional) => {
              const isExpanded = expandedId === devotional.id;
              const isToday = devotional.publish_date === todayStr;

              return (
                <div key={devotional.id} className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : devotional.id)}
                    className="w-full p-4 text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {isToday && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-600">TODAY</span>
                          )}
                          <span className="text-xs text-gray-400">
                            {new Date(devotional.publish_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                          </span>
                        </div>
                        <h3 className="mt-1 text-sm font-bold text-gray-900">{devotional.title}</h3>
                        {devotional.bible_verse && (
                          <p className="mt-0.5 text-xs text-amber-600 italic">{devotional.bible_verse}</p>
                        )}
                        {!isExpanded && (
                          <p className="mt-1 text-sm text-gray-500 line-clamp-2">{devotional.content}</p>
                        )}
                      </div>
                      <svg
                        width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        className={`flex-shrink-0 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      >
                        <path d="M6 9l6 6 6-6"/>
                      </svg>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{devotional.content}</p>
                      {isAdmin && (
                        <div className="mt-3 flex justify-end">
                          <button
                            onClick={() => deleteDevotional(devotional.id)}
                            className="text-xs text-red-400 hover:text-red-600"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
