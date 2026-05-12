"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import BottomNav from "../../../components/ui/BottomNav";

type PrayerRequest = {
  id: string;
  user_id: string;
  content: string;
  is_anonymous: boolean;
  prayer_count: number;
  created_at: string;
  user_name?: string | null;
  user_avatar?: string | null;
  has_prayed?: boolean;
};

export default function PrayerWallPage() {
  const params = useParams();
  const router = useRouter();
  const churchId = params.id as string;

  const [prayers, setPrayers] = useState<PrayerRequest[]>([]);
  const [newPrayer, setNewPrayer] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [churchName, setChurchName] = useState("");
  const [loading, setLoading] = useState(true);
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

    const { data: church } = await supabase.from("churches").select("name").eq("id", churchId).maybeSingle();
    setChurchName(church?.name || "Church");

    const { data: prayerData } = await supabase
      .from("prayer_requests")
      .select("*")
      .eq("church_id", churchId)
      .order("created_at", { ascending: false });

    if (prayerData && prayerData.length > 0) {
      const userIds = [...new Set(prayerData.filter((p) => !p.is_anonymous).map((p) => p.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds.length > 0 ? userIds : ["none"]);
      const profileMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
      (profiles || []).forEach((p) => { profileMap[p.id] = p; });

      const prayerIds = prayerData.map((p) => p.id);
      const { data: supports } = await supabase.from("prayer_supports").select("prayer_request_id").eq("user_id", me).in("prayer_request_id", prayerIds);
      const supportedSet = new Set((supports || []).map((s) => s.prayer_request_id));

      setPrayers(prayerData.map((p) => ({
        ...p,
        user_name: p.is_anonymous ? null : profileMap[p.user_id]?.full_name || null,
        user_avatar: p.is_anonymous ? null : profileMap[p.user_id]?.avatar_url || null,
        has_prayed: supportedSet.has(p.id),
      })));
    } else {
      setPrayers([]);
    }

    setLoading(false);
  }

  const submitPrayer = async () => {
    if (!currentUserId || !newPrayer.trim()) return;
    setSubmitting(true);

    await supabase.from("prayer_requests").insert([{
      church_id: churchId,
      user_id: currentUserId,
      content: newPrayer.trim(),
      is_anonymous: isAnonymous,
    }]);

    setNewPrayer("");
    setIsAnonymous(false);
    setSubmitting(false);
    loadPage();
  };

  const prayForRequest = async (prayerId: string) => {
    if (!currentUserId) return;

    const prayer = prayers.find((p) => p.id === prayerId);
    if (!prayer || prayer.has_prayed) return;

    // Optimistic
    setPrayers((prev) => prev.map((p) =>
      p.id === prayerId ? { ...p, has_prayed: true, prayer_count: p.prayer_count + 1 } : p
    ));

    await supabase.from("prayer_supports").insert([{ prayer_request_id: prayerId, user_id: currentUserId }]);
    await supabase.from("prayer_requests").update({ prayer_count: (prayer.prayer_count || 0) + 1 }).eq("id", prayerId);
  };

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Prayer Wall</h1>
            <p className="text-xs text-gray-400">{churchName}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg px-4 pt-4">
        {/* Submit prayer */}
        <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Share a Prayer Request</h2>
          <textarea
            value={newPrayer}
            onChange={(e) => setNewPrayer(e.target.value)}
            placeholder="What would you like prayer for?"
            rows={3}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-amber-300 focus:bg-white"
          />
          <div className="mt-2 flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-gray-500">
              <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} className="rounded accent-amber-400" />
              Post anonymously
            </label>
            <button
              onClick={submitPrayer}
              disabled={submitting || !newPrayer.trim()}
              className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
            >
              {submitting ? "..." : "Submit Prayer"}
            </button>
          </div>
        </div>

        {/* Prayer list */}
        {loading ? (
          <div className="mt-8 flex justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" /></div>
        ) : prayers.length === 0 ? (
          <div className="mt-8 text-center">
            <p className="text-4xl mb-2">🕊️</p>
            <p className="font-semibold text-gray-700">No prayer requests yet</p>
            <p className="text-sm text-gray-400 mt-1">Be the first to share a prayer request.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {prayers.map((prayer) => (
              <div key={prayer.id} className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
                <div className="flex items-start gap-3">
                  {prayer.is_anonymous ? (
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-lg">🙏</div>
                  ) : prayer.user_avatar ? (
                    <img src={prayer.user_avatar} alt="" className="h-10 w-10 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 font-bold text-amber-600 text-sm">
                      {(prayer.user_name || "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{prayer.is_anonymous ? "Anonymous" : prayer.user_name || "Member"}</p>
                    <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{prayer.content}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-gray-400">{new Date(prayer.created_at).toLocaleDateString()}</span>
                      <button
                        onClick={() => prayForRequest(prayer.id)}
                        disabled={prayer.has_prayed}
                        className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition ${
                          prayer.has_prayed ? "bg-amber-50 text-amber-600" : "bg-gray-50 text-gray-500 hover:bg-amber-50 hover:text-amber-500"
                        }`}
                      >
                        🙏 {prayer.prayer_count} {prayer.has_prayed ? "Prayed" : "Pray"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
