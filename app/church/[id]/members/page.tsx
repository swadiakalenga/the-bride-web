"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

type MemberRow = {
  id: string;
  user_id: string;
  status: string;
  requested_at: string;
  approved_at: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

export default function MembersPage() {
  const params = useParams();
  const router = useRouter();
  const churchId = params.id as string;

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [pending, setPending] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [tab, setTab] = useState<"pending" | "members">("pending");

  useEffect(() => {
    loadPage();
  }, [churchId]);

  async function loadPage() {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    const me = authData.user?.id;
    if (!me) { router.push("/login"); return; }
    setCurrentUserId(me);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("role, church_id")
      .eq("id", me)
      .maybeSingle();

    if (profileData?.role !== "church_admin" || profileData?.church_id !== churchId) {
      router.push("/profile");
      return;
    }
    setIsAdmin(true);

    await loadMembers();
    setLoading(false);
  }

  const loadMembers = async () => {
    const { data: memberData } = await supabase
      .from("church_memberships")
      .select("id, user_id, status, requested_at, approved_at")
      .eq("church_id", churchId)
      .order("requested_at", { ascending: false });

    if (!memberData) { setMembers([]); setPending([]); return; }

    const userIds = memberData.map((m) => m.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", userIds);

    const pMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
    (profiles || []).forEach((p) => { pMap[p.id] = p; });

    const enriched: MemberRow[] = memberData.map((m) => ({
      ...m,
      full_name: pMap[m.user_id]?.full_name || null,
      avatar_url: pMap[m.user_id]?.avatar_url || null,
    }));

    setPending(enriched.filter((m) => m.status === "pending"));
    setMembers(enriched.filter((m) => m.status === "member"));
  };

  const updateStatus = async (membershipId: string, status: "member" | "rejected") => {
    setActionLoading(membershipId);
    await supabase
      .from("church_memberships")
      .update({ status, ...(status === "member" ? { approved_at: new Date().toISOString() } : {}) })
      .eq("id", membershipId);
    setActionLoading(null);
    await loadMembers();
  };

  const revokeMembership = async (membershipId: string) => {
    if (!confirm("Remove this member?")) return;
    setActionLoading(membershipId);
    await supabase.from("church_memberships").update({ status: "rejected" }).eq("id", membershipId);
    setActionLoading(null);
    await loadMembers();
  };

  const avatarLetter = (name: string | null) =>
    (name || "U").trim().charAt(0).toUpperCase();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3 shadow-sm">
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div>
          <h1 className="font-bold text-gray-900">Church Members</h1>
          <p className="text-xs text-gray-500">{members.length} members · {pending.length} pending</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 bg-white">
        {(["pending", "members"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`relative flex-1 py-3 text-sm font-semibold capitalize transition-colors ${
              tab === t
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t}
            {t === "pending" && pending.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {pending.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mx-auto max-w-lg px-4 py-4 space-y-3">
        {tab === "pending" && (
          <>
            {pending.length === 0 ? (
              <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
                <p className="text-2xl mb-2">🎉</p>
                <p className="font-semibold text-gray-800">No pending requests</p>
                <p className="mt-1 text-sm text-gray-400">All requests have been processed.</p>
              </div>
            ) : (
              pending.map((m) => (
                <div key={m.id} className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-lg font-bold text-white">
                        {avatarLetter(m.full_name)}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{m.full_name || "User"}</p>
                      <p className="text-xs text-gray-400">
                        Requested {new Date(m.requested_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => router.push(`/user/${m.user_id}`)}
                      className="text-xs text-blue-500 hover:underline"
                    >
                      View
                    </button>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => updateStatus(m.id, "member")}
                      disabled={actionLoading === m.id}
                      className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white disabled:bg-blue-300"
                    >
                      {actionLoading === m.id ? "..." : "Accept"}
                    </button>
                    <button
                      onClick={() => updateStatus(m.id, "rejected")}
                      disabled={actionLoading === m.id}
                      className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {tab === "members" && (
          <>
            {members.length === 0 ? (
              <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
                <p className="text-2xl mb-2">👥</p>
                <p className="font-semibold text-gray-800">No members yet</p>
                <p className="mt-1 text-sm text-gray-400">Accept membership requests to grow your community.</p>
              </div>
            ) : (
              members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-lg font-bold text-white">
                      {avatarLetter(m.full_name)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{m.full_name || "User"}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <p className="text-xs text-gray-400">
                        Member since {m.approved_at ? new Date(m.approved_at).toLocaleDateString() : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => router.push(`/user/${m.user_id}`)}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      View
                    </button>
                    <button
                      onClick={() => revokeMembership(m.id)}
                      disabled={actionLoading === m.id}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </main>
  );
}
