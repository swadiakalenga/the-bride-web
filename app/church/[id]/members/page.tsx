"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import { useLanguage } from "../../../../lib/useLanguage";
import { createNotification } from "../../../../lib/notificationPush";

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
  const { t } = useLanguage();
  const churchId = params.id as string;

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
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

  const updateStatus = async (row: MemberRow, status: "member" | "rejected") => {
    if (!currentUserId) return;
    setActionLoading(row.id);

    await supabase
      .from("church_memberships")
      .update({
        status,
        ...(status === "member" ? { approved_at: new Date().toISOString() } : {}),
      })
      .eq("id", row.id);

    // Notify the user of the outcome
    await createNotification({
      recipientUserId: row.user_id,
      actorUserId: currentUserId,
      type: status === "member" ? "membership_approved" : "membership_rejected",
      churchId,
    });

    setActionLoading(null);
    await loadMembers();
  };

  const revokeMembership = async (row: MemberRow) => {
    if (!confirm(t("common_confirm"))) return;
    if (!currentUserId) return;
    setActionLoading(row.id);

    await supabase
      .from("church_memberships")
      .update({ status: "rejected" })
      .eq("id", row.id);

    // Notify the user that their membership was revoked
    await createNotification({
      recipientUserId: row.user_id,
      actorUserId: currentUserId,
      type: "membership_rejected",
      churchId,
    });

    setActionLoading(null);
    await loadMembers();
  };

  const avatarLetter = (name: string | null) =>
    (name || "U").trim().charAt(0).toUpperCase();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
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
          aria-label={t("common_back")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div>
          <h1 className="font-bold text-gray-900">{t("church_members_title")}</h1>
          <p className="text-xs text-gray-500">
            {t("church_members_count", members.length)} · {pending.length} {t("church_members_pending").toLowerCase()}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 bg-white">
        {(["pending", "members"] as const).map((tab_key) => (
          <button
            key={tab_key}
            type="button"
            onClick={() => setTab(tab_key)}
            className={`relative flex-1 py-3 text-sm font-semibold capitalize transition-colors ${
              tab === tab_key
                ? "border-b-2 border-brand-500 text-brand-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab_key === "pending" ? t("church_members_pending") : t("church_members_title")}
            {tab_key === "pending" && pending.length > 0 && (
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
                <p className="font-semibold text-gray-800">{t("church_no_pending")}</p>
                <p className="mt-1 text-sm text-gray-400">{t("church_no_pending_desc")}</p>
              </div>
            ) : (
              pending.map((m) => (
                <div key={m.id} className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-lg font-bold text-white">
                        {avatarLetter(m.full_name)}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{m.full_name || "User"}</p>
                      <p className="text-xs text-gray-400">
                        {t("church_requested", new Date(m.requested_at).toLocaleDateString())}
                      </p>
                    </div>
                    <button
                      onClick={() => router.push(`/user/${m.user_id}`)}
                      className="text-xs text-brand-500 hover:underline"
                    >
                      {t("common_view")}
                    </button>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => updateStatus(m, "member")}
                      disabled={actionLoading === m.id}
                      className="flex-1 rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white disabled:bg-brand-300"
                    >
                      {actionLoading === m.id ? "…" : t("church_accept")}
                    </button>
                    <button
                      onClick={() => updateStatus(m, "rejected")}
                      disabled={actionLoading === m.id}
                      className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                    >
                      {t("church_decline")}
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
                <p className="font-semibold text-gray-800">{t("church_no_members")}</p>
                <p className="mt-1 text-sm text-gray-400">{t("church_no_members_desc")}</p>
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
                        {m.approved_at
                          ? t("church_member_since", new Date(m.approved_at).toLocaleDateString())
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => router.push(`/user/${m.user_id}`)}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      {t("common_view")}
                    </button>
                    <button
                      onClick={() => revokeMembership(m)}
                      disabled={actionLoading === m.id}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50"
                    >
                      {t("church_remove")}
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
