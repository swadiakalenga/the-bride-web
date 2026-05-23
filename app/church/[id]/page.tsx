"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { useLanguage } from "../../../lib/useLanguage";
import BottomNav from "../../components/ui/BottomNav";

type ReplayCard = {
  id: string;
  title: string;
  thumbnail_url: string | null;
  ended_at: string | null;
  hls_url: string | null;
};

type ChurchPost = {
  id: string;
  content: string | null;
  media_urls: string[] | null;
  media_type: string | null;
  author_name: string | null;
  created_at: string;
};

type ChurchInfo = {
  id: string;
  name: string;
  description: string | null;
  pastor_name: string | null;
  location: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  created_at: string;
  physical_address: string | null;
  address_line2: string | null;
  state_region: string | null;
  postal_code: string | null;
  public_address: boolean | null;
};

export default function ChurchProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { t, lang } = useLanguage();
  const churchId = params.id as string;
  const isFr = lang === "fr";

  const [church,       setChurch]       = useState<ChurchInfo | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [viewerRole,   setViewerRole]   = useState<string | null>(null);
  const [isAdmin,      setIsAdmin]      = useState(false);

  const [isMember,     setIsMember]     = useState(false);
  const [memberCount,  setMemberCount]  = useState(0);
  const [pendingRequest, setPendingRequest] = useState(false);
  const [joinLoading,  setJoinLoading]  = useState(false);

  // Block state
  const [isBlocked,    setIsBlocked]    = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [debugError,   setDebugError]   = useState<string | null>(null);

  // Replay cards (recent ended streams)
  const [recentReplays, setRecentReplays] = useState<ReplayCard[]>([]);

  // Church posts
  const [churchPosts, setChurchPosts] = useState<ChurchPost[]>([]);

  // Image upload state (admin only)
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover,  setUploadingCover]  = useState(false);
  const [uploadError,     setUploadError]     = useState<string | null>(null);

  useEffect(() => { loadChurch(); }, [churchId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadChurch() {
    setLoading(true);
    setDebugError(null);
    const { data: authData } = await supabase.auth.getUser();
    const me = authData.user?.id;
    if (!me) { router.push("/login"); return; }
    setCurrentUserId(me);

    const { data: churchData, error: churchErr } = await supabase
      .from("churches")
      .select("id, name, description, pastor_name, location, avatar_url, cover_url, email, phone, website, city, country, created_at, physical_address, address_line2, state_region, postal_code, public_address")
      .eq("id", churchId)
      .maybeSingle();

    if (churchErr) setDebugError(churchErr.message);
    if (!churchData) { setLoading(false); return; }
    setChurch(churchData as ChurchInfo);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, church_id")
      .eq("id", me)
      .maybeSingle();

    const rawRole     = profile?.role ?? null;
    const rawChurchId = profile?.church_id ?? null;

    setViewerRole(rawRole);

    // Trim both sides to guard against whitespace / copy-paste artefacts in the DB.
    // Only grant admin when role AND church_id both match this exact church.
    const adminOfThisChurch =
      rawRole === "church_admin" &&
      rawChurchId != null &&
      rawChurchId.trim() === churchId.trim();

    setIsAdmin(adminOfThisChurch);

    const [{ data: membership }, { count }, { data: blockRow }] = await Promise.all([
      supabase
        .from("church_memberships")
        .select("status")
        .eq("church_id", churchId)
        .eq("user_id", me)
        .maybeSingle(),
      supabase
        .from("church_memberships")
        .select("*", { count: "exact", head: true })
        .eq("church_id", churchId)
        .eq("status", "approved"),
      supabase
        .from("user_blocks")
        .select("id")
        .eq("blocker_id", me)
        .eq("blocked_id", churchId)
        .maybeSingle(),
    ]);

    if (membership) {
      setIsMember(membership.status === "approved");
      setPendingRequest(membership.status === "pending");
    }
    setMemberCount(count || 0);
    setIsBlocked(!!blockRow);

    // Load recent replays for this church (public — no stream_key selected)
    const { data: replayData } = await supabase
      .from("church_live_events")
      .select("id, title, thumbnail_url, ended_at, hls_url")
      .eq("church_id", churchId)
      .eq("status", "ended")
      .eq("replay_enabled", true)
      .not("hls_url", "is", null)
      .order("ended_at", { ascending: false })
      .limit(6);

    setRecentReplays((replayData ?? []) as ReplayCard[]);

    // Load recent church posts
    const { data: postsData } = await supabase
      .from("posts")
      .select("id, content, media_urls, media_type, author_name, created_at")
      .eq("church_id", churchId)
      .order("created_at", { ascending: false })
      .limit(10);

    setChurchPosts((postsData ?? []) as ChurchPost[]);

    setLoading(false);
  }

  const requestToJoin = async () => {
    if (!currentUserId) return;
    setJoinLoading(true);
    await supabase.from("church_memberships").insert([{ church_id: churchId, user_id: currentUserId, status: "pending" }]);
    setPendingRequest(true);
    setJoinLoading(false);
  };

  const leaveChurch = async () => {
    if (!currentUserId || !confirm(isFr ? "Quitter cette église ?" : "Leave this church?")) return;
    setJoinLoading(true);
    await supabase.from("church_memberships").delete().eq("church_id", churchId).eq("user_id", currentUserId);
    setIsMember(false);
    setPendingRequest(false);
    setMemberCount((prev) => Math.max(0, prev - 1));
    setJoinLoading(false);
  };

  const handleBlock = async () => {
    if (!currentUserId) return;
    setBlockLoading(true);
    if (isBlocked) {
      await supabase.from("user_blocks").delete().eq("blocker_id", currentUserId).eq("blocked_id", churchId);
      setIsBlocked(false);
    } else {
      await supabase.from("user_blocks").insert([{ blocker_id: currentUserId, blocked_id: churchId }]);
      setIsBlocked(true);
    }
    setBlockLoading(false);
    setShowBlockConfirm(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    if (!file.type.startsWith("image/")) { setUploadError(isFr ? "Fichier image uniquement." : "Image files only."); return; }
    if (file.size > 2 * 1024 * 1024) { setUploadError(isFr ? "Avatar : 2 Mo maximum." : "Avatar must be under 2 MB."); return; }
    setUploadingAvatar(true);
    const ext  = file.name.split(".").pop();
    const path = `churches/${churchId}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("media").upload(path, file, { upsert: true });
    if (upErr) { setUploadError(upErr.message); setUploadingAvatar(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(path);
    const { error: dbErr } = await supabase.from("churches").update({ avatar_url: publicUrl }).eq("id", churchId);
    if (dbErr) { setUploadError(dbErr.message); } else { setChurch((prev) => prev ? { ...prev, avatar_url: publicUrl } : prev); }
    setUploadingAvatar(false);
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    if (!file.type.startsWith("image/")) { setUploadError(isFr ? "Fichier image uniquement." : "Image files only."); return; }
    if (file.size > 5 * 1024 * 1024) { setUploadError(isFr ? "Couverture : 5 Mo maximum." : "Cover must be under 5 MB."); return; }
    setUploadingCover(true);
    const ext  = file.name.split(".").pop();
    const path = `churches/${churchId}/cover-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("media").upload(path, file, { upsert: true });
    if (upErr) { setUploadError(upErr.message); setUploadingCover(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(path);
    const { error: dbErr } = await supabase.from("churches").update({ cover_url: publicUrl }).eq("id", churchId);
    if (dbErr) { setUploadError(dbErr.message); } else { setChurch((prev) => prev ? { ...prev, cover_url: publicUrl } : prev); }
    setUploadingCover(false);
  };

  // Address line shown on profile (only if public_address !== false)
  const publicAddress = church?.public_address !== false
    ? [church?.physical_address, church?.address_line2, church?.state_region, church?.postal_code]
        .filter(Boolean).join(", ") || church?.location || null
    : church?.location || null;

  const sectionLinks = [
    { icon: "🙏", label: isFr ? "Mur de prière" : "Prayer Wall", description: isFr ? "Partagez des requêtes de prière" : "Share and support prayer requests", href: `/church/${churchId}/prayers` },
    { icon: "📅", label: isFr ? "Événements" : "Events", description: isFr ? "Événements à venir" : "Upcoming church events", href: `/church/${churchId}/events` },
    { icon: "📖", label: isFr ? "Dévotions" : "Devotionals", description: isFr ? "Dévotions et réflexions" : "Daily devotionals and reflections", href: `/church/${churchId}/devotionals` },
    { icon: "💝", label: isFr ? "Dîme & Offrandes" : "Tithe & Giving", description: isFr ? "Soutenez votre église" : "Support your church", href: `/church/${churchId}/tithe` },
  ];

  if (isAdmin) {
    sectionLinks.push(
      { icon: "📺", label: isFr ? "Gérer le live" : "Manage Live", description: isFr ? "Planifier, diffuser en direct, gérer les replays" : "Schedule, go live, and manage replays", href: `/church/${churchId}/live/manage` },
      { icon: "👥", label: isFr ? "Gérer les membres" : "Manage Members", description: isFr ? "Approuver les demandes" : "Approve requests & view members", href: `/church/${churchId}/members` },
      { icon: "✅", label: isFr ? "Vérification" : "Verification", description: isFr ? "Soumettre les documents de localisation" : "Submit location proof documents", href: `/church/${churchId}/verify` },
      { icon: "💳", label: isFr ? "Versements" : "Payouts", description: isFr ? "Configurer les versements" : "Set up payout information", href: `/church/${churchId}/payouts` },
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <h1 className="text-lg font-bold text-gray-900">{isFr ? "Église" : "Church"}</h1>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg">
        {!church ? (
          <div className="mt-8 px-4 space-y-3">
            <div className="text-center">
              <p className="text-4xl mb-2">⛪</p>
              <p className="font-semibold text-gray-700">{isFr ? "Église introuvable" : "Church not found"}</p>
            </div>
            {/* Temporary debug block — remove once RLS + schema are confirmed */}
            <div className="rounded-xl bg-gray-100 border border-gray-200 px-4 py-3 text-xs text-gray-600 space-y-1 font-mono">
              <p><span className="font-bold text-gray-800">route id:</span> {churchId}</p>
              <p><span className="font-bold text-gray-800">error:</span> {debugError ?? "none — data is null (row missing or RLS silently blocked)"}</p>
              <p><span className="font-bold text-gray-800">data:</span> null</p>
            </div>
          </div>
        ) : (
          <>
            {/* Church info banner */}
            <div className="bg-white border-b border-gray-100">
              {/* Cover */}
              <div className="relative h-52 overflow-hidden bg-gradient-to-br from-amber-600 via-amber-400 to-amber-200">
                {church.cover_url && (
                  <img src={church.cover_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                )}
                {isAdmin && (
                  <label className="absolute bottom-3 right-3 flex cursor-pointer items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm hover:bg-black/60 transition">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    {uploadingCover ? "…" : (isFr ? "Modifier la couverture" : "Edit cover")}
                    <input type="file" accept="image/*" className="sr-only" onChange={handleCoverUpload} disabled={uploadingCover} />
                  </label>
                )}
              </div>

              <div className="px-4 pb-4">
                {/* Avatar */}
                <div className="relative -mt-12 mb-3 w-fit">
                  {church.avatar_url ? (
                    <img src={church.avatar_url} alt={church.name} className="h-24 w-24 rounded-2xl border-4 border-white object-cover shadow-md" />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-2xl border-4 border-white bg-amber-100 text-4xl shadow-md">⛪</div>
                  )}
                  {isAdmin && (
                    <label className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-amber-500 text-white shadow-md hover:bg-amber-600 transition">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      <input type="file" accept="image/*" className="sr-only" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                    </label>
                  )}
                </div>

                <h2 className="text-xl font-bold text-gray-900">{church.name}</h2>
                {church.pastor_name && (
                  <p className="text-sm text-gray-500 mt-0.5">{isFr ? "Pasteur" : "Pastor"} {church.pastor_name}</p>
                )}
                {publicAddress && (
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <span>📍</span> {publicAddress}
                  </p>
                )}
                {church.description && (
                  <p className="mt-3 text-sm text-gray-600 leading-relaxed">{church.description}</p>
                )}

                <div className="mt-3 flex items-center gap-4 text-sm">
                  <span className="text-gray-600">
                    <span className="font-bold text-gray-900">{memberCount}</span>{" "}
                    {memberCount === 1 ? (isFr ? "membre" : "member") : (isFr ? "membres" : "members")}
                  </span>
                </div>

                {uploadError && (
                  <div className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{uploadError}</div>
                )}

                {/* Action buttons */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {isAdmin ? (
                    <div className="rounded-full bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-600">
                      {isFr ? "Admin de l'église" : "Church Admin"}
                    </div>
                  ) : viewerRole === "church_admin" && !isAdmin ? (
                    /* A church admin viewing a DIFFERENT church — they can't join/follow as a member */
                    <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-2 text-xs text-gray-500 max-w-xs">
                      {t("church_account_no_follow")}
                    </div>
                  ) : isMember ? (
                    <button
                      onClick={leaveChurch}
                      disabled={joinLoading}
                      className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {joinLoading ? "..." : (isFr ? "Quitter l'église" : "Leave Church")}
                    </button>
                  ) : pendingRequest ? (
                    <div className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-500">
                      {isFr ? "Demande en attente" : "Request Pending"}
                    </div>
                  ) : (
                    <button
                      onClick={requestToJoin}
                      disabled={joinLoading}
                      className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
                    >
                      {joinLoading ? "..." : (isFr ? "Rejoindre l'église" : "Join Church")}
                    </button>
                  )}

                  {/* Block button — shown to non-admin viewers */}
                  {!isAdmin && (
                    <button
                      onClick={() => isBlocked ? handleBlock() : setShowBlockConfirm(true)}
                      disabled={blockLoading}
                      className={`rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                        isBlocked
                          ? "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                          : "border border-gray-200 bg-white text-red-500 hover:bg-red-50"
                      }`}
                    >
                      {blockLoading ? "..." : isBlocked ? t("unblock_church") : t("block_church")}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Block confirm dialog */}
            {showBlockConfirm && (
              <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 px-4 pb-8">
                <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-4">
                  <p className="font-semibold text-gray-900">{t("block_church")}</p>
                  <p className="text-sm text-gray-600">{t("block_church_confirm")}</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowBlockConfirm(false)}
                      className="flex-1 rounded-xl border border-gray-200 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                    >
                      {isFr ? "Annuler" : "Cancel"}
                    </button>
                    <button
                      onClick={handleBlock}
                      disabled={blockLoading}
                      className="flex-1 rounded-xl bg-red-500 py-2 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-60"
                    >
                      {blockLoading ? "..." : t("block_church")}
                    </button>
                  </div>
                </div>
              </div>
            )}

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

            {/* Recent Replays */}
            {recentReplays.length > 0 && (
              <div className="px-4 pt-6 pb-2">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                    <span>🎬</span>
                    {isFr ? "Replays récents" : "Recent Replays"}
                  </h3>
                  <button
                    onClick={() => router.push("/live")}
                    className="text-xs font-semibold text-amber-600 hover:text-amber-700"
                  >
                    {isFr ? "Voir tout" : "See all"}
                  </button>
                </div>

                <div className="space-y-2">
                  {recentReplays.map((replay) => (
                    <button
                      key={replay.id}
                      onClick={() => router.push(`/live/${replay.id}`)}
                      className="flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-gray-100 bg-white p-3 text-left shadow-sm hover:shadow-md transition"
                    >
                      {/* Thumbnail */}
                      <div className="relative h-14 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-gray-900">
                        {replay.thumbnail_url ? (
                          <img
                            src={replay.thumbnail_url}
                            alt={replay.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xl opacity-30">
                            📡
                          </div>
                        )}
                        <span className="absolute left-1.5 top-1.5 rounded-full bg-gray-700/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                          Replay
                        </span>
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="line-clamp-2 text-xs font-semibold leading-snug text-gray-900">
                          {replay.title}
                        </p>
                        {replay.ended_at && (
                          <p className="mt-0.5 text-[11px] text-gray-400">
                            {new Date(replay.ended_at).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        )}
                      </div>
                      {/* Watch arrow */}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-gray-300">
                        <path d="M9 18l6-6-6-6"/>
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Church Posts ── */}
            <div className="px-4 pt-6 pb-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
                <span>📝</span>
                {isFr ? "Publications" : "Posts"}
              </h3>

              {churchPosts.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white py-10 text-center">
                  <span className="text-3xl opacity-40">📢</span>
                  <p className="mt-2 text-sm font-semibold text-gray-500">
                    {isFr ? "Aucune publication pour l'instant" : "No posts yet"}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {isFr ? "Les publications de cette église apparaîtront ici." : "This church's posts will appear here."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {churchPosts.map((post) => {
                    const firstImage = post.media_urls?.[0] ?? null;
                    return (
                      <button
                        key={post.id}
                        onClick={() => router.push(`/post/${post.id}`)}
                        className="w-full overflow-hidden rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm hover:shadow-md transition"
                      >
                        {/* Author + date row */}
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-gray-700 truncate">
                            {post.author_name || church?.name || "Church"}
                          </span>
                          <span className="flex-shrink-0 text-[11px] text-gray-400">
                            {new Date(post.created_at).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        </div>

                        {/* Image thumbnail */}
                        {firstImage && post.media_type !== "audio" && post.media_type !== "video" && (
                          <div className="mb-2 overflow-hidden rounded-xl">
                            <img
                              src={firstImage}
                              alt=""
                              className="h-40 w-full object-cover"
                            />
                          </div>
                        )}

                        {/* Video placeholder */}
                        {post.media_type === "video" && (
                          <div className="mb-2 flex h-24 w-full items-center justify-center rounded-xl bg-gray-100 text-2xl">
                            🎬
                          </div>
                        )}

                        {/* Audio placeholder */}
                        {post.media_type === "audio" && (
                          <div className="mb-2 flex h-12 w-full items-center justify-center rounded-xl bg-gray-100 text-xl gap-2">
                            <span>🎵</span>
                            <span className="text-xs font-medium text-gray-500">{isFr ? "Audio" : "Audio"}</span>
                          </div>
                        )}

                        {/* Content */}
                        {post.content && (
                          <p className="line-clamp-3 text-sm leading-relaxed text-gray-700">
                            {post.content}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
