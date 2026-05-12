"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import BottomNav from "../../components/ui/BottomNav";

type ChurchInfo = {
  id: string;
  name: string;
  description: string | null;
  pastor_name: string | null;
  location: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  created_at: string;
};

export default function ChurchProfilePage() {
  const params = useParams();
  const router = useRouter();
  const churchId = params.id as string;

  const [church, setChurch] = useState<ChurchInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [memberCount, setMemberCount] = useState(0);
  const [pendingRequest, setPendingRequest] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);

  useEffect(() => {
    loadChurch();
  }, [churchId]);

  async function loadChurch() {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    const me = authData.user?.id;
    if (!me) { router.push("/login"); return; }
    setCurrentUserId(me);

    // Church info
    const { data: churchData } = await supabase
      .from("churches")
      .select("*")
      .eq("id", churchId)
      .maybeSingle();

    if (!churchData) {
      setLoading(false);
      return;
    }
    setChurch(churchData);

    // User's profile to check admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, church_id")
      .eq("id", me)
      .maybeSingle();
    setIsAdmin(profile?.role === "church_admin" && profile?.church_id === churchId);

    // Membership check
    const { data: membership } = await supabase
      .from("church_memberships")
      .select("status")
      .eq("church_id", churchId)
      .eq("user_id", me)
      .maybeSingle();

    if (membership) {
      setIsMember(membership.status === "approved");
      setPendingRequest(membership.status === "pending");
    }

    // Member count
    const { count } = await supabase
      .from("church_memberships")
      .select("*", { count: "exact", head: true })
      .eq("church_id", churchId)
      .eq("status", "approved");
    setMemberCount(count || 0);

    setLoading(false);
  }

  const requestToJoin = async () => {
    if (!currentUserId) return;
    setJoinLoading(true);

    await supabase.from("church_memberships").insert([{
      church_id: churchId,
      user_id: currentUserId,
      status: "pending",
    }]);

    setPendingRequest(true);
    setJoinLoading(false);
  };

  const leaveChurch = async () => {
    if (!currentUserId || !confirm("Leave this church?")) return;
    setJoinLoading(true);

    await supabase
      .from("church_memberships")
      .delete()
      .eq("church_id", churchId)
      .eq("user_id", currentUserId);

    setIsMember(false);
    setPendingRequest(false);
    setMemberCount((prev) => Math.max(0, prev - 1));
    setJoinLoading(false);
  };

  const sectionLinks = [
    {
      icon: "🙏",
      label: "Prayer Wall",
      description: "Share and support prayer requests",
      href: `/church/${churchId}/prayers`,
    },
    {
      icon: "📅",
      label: "Events",
      description: "Upcoming church events",
      href: `/church/${churchId}/events`,
    },
    {
      icon: "📖",
      label: "Devotionals",
      description: "Daily devotionals and reflections",
      href: `/church/${churchId}/devotionals`,
    },
    {
      icon: "💝",
      label: "Tithe & Giving",
      description: "Support your church",
      href: `/church/${churchId}/tithe`,
    },
  ];

  if (isAdmin) {
    sectionLinks.push({
      icon: "👥",
      label: "Manage Members",
      description: "Approve requests & view members",
      href: `/church/${churchId}/members`,
    });
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <h1 className="text-lg font-bold text-gray-900">Church</h1>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg">
        {loading ? (
          <div className="mt-8 flex justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" /></div>
        ) : !church ? (
          <div className="mt-8 text-center px-4">
            <p className="text-4xl mb-2">⛪</p>
            <p className="font-semibold text-gray-700">Church not found</p>
          </div>
        ) : (
          <>
            {/* Church info banner */}
            <div className="bg-white border-b border-gray-100">
              {/* Cover area */}
              <div className="h-32 bg-gradient-to-br from-amber-200 via-amber-100 to-amber-50 relative">
                {church.cover_url && (
                  <img src={church.cover_url} alt="" className="h-full w-full object-cover" />
                )}
              </div>

              <div className="px-4 pb-4">
                {/* Avatar overlapping cover */}
                <div className="-mt-10 mb-3">
                  {church.avatar_url ? (
                    <img src={church.avatar_url} alt={church.name} className="h-20 w-20 rounded-2xl border-4 border-white object-cover shadow-sm" />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white bg-amber-100 text-3xl shadow-sm">
                      ⛪
                    </div>
                  )}
                </div>

                <h2 className="text-xl font-bold text-gray-900">{church.name}</h2>
                {church.pastor_name && (
                  <p className="text-sm text-gray-500 mt-0.5">Pastor {church.pastor_name}</p>
                )}
                {church.location && (
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <span>📍</span> {church.location}
                  </p>
                )}
                {church.description && (
                  <p className="mt-3 text-sm text-gray-600 leading-relaxed">{church.description}</p>
                )}

                {/* Stats row */}
                <div className="mt-3 flex items-center gap-4 text-sm">
                  <span className="text-gray-600">
                    <span className="font-bold text-gray-900">{memberCount}</span> {memberCount === 1 ? "member" : "members"}
                  </span>
                </div>

                {/* Action buttons */}
                <div className="mt-4 flex gap-2">
                  {isAdmin ? (
                    <div className="rounded-full bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-600">
                      Church Admin
                    </div>
                  ) : isMember ? (
                    <button
                      onClick={leaveChurch}
                      disabled={joinLoading}
                      className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {joinLoading ? "..." : "Leave Church"}
                    </button>
                  ) : pendingRequest ? (
                    <div className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-500">
                      Request Pending
                    </div>
                  ) : (
                    <button
                      onClick={requestToJoin}
                      disabled={joinLoading}
                      className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
                    >
                      {joinLoading ? "..." : "Join Church"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Section links */}
            <div className="px-4 pt-4 space-y-2">
              {sectionLinks.map((section) => (
                <button
                  key={section.href}
                  onClick={() => router.push(section.href)}
                  className="w-full flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm border border-gray-100 text-left hover:shadow-md transition"
                >
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-amber-50 text-xl">
                    {section.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{section.label}</p>
                    <p className="text-xs text-gray-400">{section.description}</p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 flex-shrink-0">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
