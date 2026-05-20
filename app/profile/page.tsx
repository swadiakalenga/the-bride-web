"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { useLanguage } from "../../lib/useLanguage";
import BottomNav from "../components/ui/BottomNav";
import Card from "../components/ui/Card";
import FollowListModal from "../components/ui/FollowListModal";

type Profile = {
  id: string;
  full_name: string | null;
  role: string | null;
  avatar_url: string | null;
  city: string | null;
  country: string | null;
  church_id: string | null;
  bio: string | null;
};

type Church = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  pastor_name: string | null;
  description: string | null;
  email: string | null;
  phone: string | null;
};

type ChurchOption = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [myChurch, setMyChurch] = useState<Church | null>(null);
  const [churchOptions, setChurchOptions] = useState<ChurchOption[]>([]);
  const [status, setStatus] = useState("Loading profile...");
  const [uiMessage, setUiMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Shared fields
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [bio, setBio] = useState("");

  // Personal fields
  const [fullName, setFullName] = useState("");
  const [churchId, setChurchId] = useState("");

  // Church admin fields
  const [churchName, setChurchName] = useState("");
  const [pastorName, setPastorName] = useState("");
  const [churchEmail, setChurchEmail] = useState("");
  const [churchPhone, setChurchPhone] = useState("");

  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followModal, setFollowModal] = useState<"followers" | "following" | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isChurchAdmin = profile?.role === "church_admin";

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setStatus("Loading...");

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) { router.push("/login"); return; }

    const userId = userData.user.id;

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role, avatar_url, city, country, church_id, bio")
      .eq("id", userId)
      .maybeSingle();

    if (error) { setStatus(`Error: ${error.message}`); return; }
    if (!data) { setStatus("No profile found."); return; }

    setProfile(data);
    setFullName(data.full_name || "");
    setCity(data.city || "");
    setCountry(data.country || "");
    setChurchId(data.church_id || "");
    setBio(data.bio || "");

    if (data.role === "church_admin" && data.church_id) {
      const { data: churchData } = await supabase
        .from("churches")
        .select("id, name, city, country, pastor_name, description, email, phone")
        .eq("id", data.church_id)
        .maybeSingle();

      if (churchData) {
        setMyChurch(churchData);
        setChurchName(churchData.name || "");
        setPastorName(churchData.pastor_name || "");
        setChurchEmail(churchData.email || "");
        setChurchPhone(churchData.phone || "");
        setCity(churchData.city || "");
        setCountry(churchData.country || "");
        setBio(churchData.description || "");
      }
    } else {
      const { data: churchList } = await supabase
        .from("churches")
        .select("id, name, city, country")
        .order("name", { ascending: true });
      setChurchOptions(churchList || []);
    }

    const [{ count: followers }, { count: following }] = await Promise.all([
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId),
    ]);

    setFollowersCount(followers || 0);
    setFollowingCount(following || 0);
    setStatus("loaded");
  }

  const uploadAvatar = async (file: File) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    setUploading(true);
    const ext = file.name.split(".").pop();
    const filePath = `${userData.user.id}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file);
    if (uploadError) {
      setUploading(false);
      setUiMessage(`Upload failed: ${uploadError.message}`);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
    await supabase.from("profiles").update({ avatar_url: publicUrlData.publicUrl }).eq("id", userData.user.id);

    setUploading(false);
    await loadProfile();
  };

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);

    if (isChurchAdmin && myChurch) {
      // Update both the churches table and the profiles table
      const [{ error: churchError }, { error: profileError }] = await Promise.all([
        supabase.from("churches").update({
          name: churchName.trim(),
          pastor_name: pastorName.trim() || null,
          email: churchEmail.trim() || null,
          phone: churchPhone.trim() || null,
          city: city.trim() || null,
          country: country.trim() || null,
          description: bio.trim() || null,
        }).eq("id", myChurch.id),
        supabase.from("profiles").update({
          full_name: churchName.trim(),
          city: city.trim() || null,
          country: country.trim() || null,
          bio: bio.trim() || null,
        }).eq("id", profile.id),
      ]);

      setSaving(false);
      if (churchError || profileError) {
        setUiMessage(`Save failed: ${(churchError || profileError)?.message}`);
        return;
      }
    } else {
      const { error } = await supabase.from("profiles").update({
        full_name: fullName.trim(),
        city: city.trim() || null,
        country: country.trim() || null,
        church_id: churchId || null,
        bio: bio.trim() || null,
      }).eq("id", profile.id);

      setSaving(false);
      if (error) {
        setUiMessage(`Save failed: ${error.message}`);
        return;
      }
    }

    setUiMessage("Profile saved.");
    await loadProfile();
    setIsEditing(false);
  };

  const cancelEdit = () => {
    if (isChurchAdmin && myChurch) {
      setChurchName(myChurch.name || "");
      setPastorName(myChurch.pastor_name || "");
      setChurchEmail(myChurch.email || "");
      setChurchPhone(myChurch.phone || "");
      setCity(myChurch.city || "");
      setCountry(myChurch.country || "");
      setBio(myChurch.description || "");
    } else {
      setFullName(profile?.full_name || "");
      setCity(profile?.city || "");
      setCountry(profile?.country || "");
      setChurchId(profile?.church_id || "");
      setBio(profile?.bio || "");
    }
    setIsEditing(false);
  };

  const memberChurchName = churchOptions.find((c) => c.id === profile?.church_id)?.name || null;
  const memberChurch = churchOptions.find((c) => c.id === profile?.church_id) || null;
  const avatarLetter = (
    isChurchAdmin ? myChurch?.name : profile?.full_name || "U"
  )?.trim().charAt(0).toUpperCase() || "U";

  const displayName = isChurchAdmin
    ? (myChurch?.name || profile?.full_name || "Church")
    : (profile?.full_name || "No name");

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
        <p className="text-gray-500">{status}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-20 lg:pb-6">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg lg:max-w-7xl items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-gray-900">{t("nav_profile")}</h1>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 pt-4">
        <div className="grid grid-cols-12 gap-6">

          {/* ── Left sidebar ── */}
          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-[72px] space-y-3">
              <Card>
                <nav className="space-y-0.5">
                  <button
                    onClick={() => router.push("/feed")}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-gray-400">
                      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
                      <path d="M9 21V12h6v9" />
                    </svg>
                    Home
                  </button>
                  <button
                    onClick={() => router.push("/search")}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-gray-400">
                      <circle cx="11" cy="11" r="8" />
                      <path d="M21 21l-4.35-4.35" />
                    </svg>
                    Search
                  </button>
                  <button
                    onClick={() => router.push("/messages")}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-gray-400">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                    Messages
                  </button>
                  <button
                    onClick={() => router.push("/notifications")}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-gray-400">
                      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 01-3.46 0" />
                    </svg>
                    Alerts
                  </button>
                  <button
                    onClick={() => router.push("/profile")}
                    className="flex w-full items-center gap-3 rounded-xl bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-600"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-amber-400">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    My Profile
                  </button>
                </nav>
              </Card>

              {/* Church admin shortcuts */}
              {isChurchAdmin && myChurch && (
                <Card>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Church Admin</p>
                  <div className="space-y-0.5">
                    <button
                      onClick={() => router.push(`/church/${myChurch.id}`)}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      ⛪ View Church
                    </button>
                    <button
                      onClick={() => router.push(`/church/${myChurch.id}/members`)}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      👥 Members
                    </button>
                    <button
                      onClick={() => router.push(`/church/${myChurch.id}/prayers`)}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      🙏 Prayer Wall
                    </button>
                    <button
                      onClick={() => router.push(`/church/${myChurch.id}/events`)}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      📅 Events
                    </button>
                    <button
                      onClick={() => router.push(`/church/${myChurch.id}/devotionals`)}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      📖 Devotionals
                    </button>
                  </div>
                </Card>
              )}
            </div>
          </aside>

          {/* ── Center content ── */}
          <section className="col-span-12 lg:col-span-6">
            {uiMessage && (
              <div className={`mb-4 rounded-xl px-4 py-3 text-sm ${uiMessage.toLowerCase().includes("failed") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
                {uiMessage}
              </div>
            )}

            <div className="rounded-2xl bg-white p-6 shadow">

              {/* ── VIEW MODE ── */}
              {!isEditing && (
                <>
                  <div className="flex flex-col items-center">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt="Profile" className="h-28 w-28 rounded-full border object-cover" />
                    ) : (
                      <div className="flex h-28 w-28 items-center justify-center rounded-full border bg-gray-200 text-4xl font-bold text-gray-600">
                        {avatarLetter}
                      </div>
                    )}
                    <h1 className="mt-4 text-2xl font-bold text-gray-900">{displayName}</h1>
                    {isChurchAdmin && myChurch?.pastor_name && (
                      <p className="mt-1 text-sm text-gray-500">Pastor: {myChurch.pastor_name}</p>
                    )}
                  </div>

                  <div className="mt-6 flex items-center justify-center gap-8 rounded-xl bg-gray-50 p-4">
                    <button
                      onClick={() => setFollowModal("followers")}
                      className="text-center hover:opacity-75 transition-opacity"
                    >
                      <p className="text-2xl font-bold">{followersCount}</p>
                      <p className="text-sm text-gray-500">{t("profile_followers")}</p>
                    </button>
                    <button
                      onClick={() => setFollowModal("following")}
                      className="text-center hover:opacity-75 transition-opacity"
                    >
                      <p className="text-2xl font-bold">{followingCount}</p>
                      <p className="text-sm text-gray-500">{t("profile_following")}</p>
                    </button>
                  </div>

                  <button
                    onClick={() => setIsEditing(true)}
                    className="mt-4 w-full rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {t("profile_edit")}
                  </button>

                  {/* Church profile link */}
                  {isChurchAdmin && myChurch && (
                    <div className="mt-3 space-y-2">
                      <button
                        onClick={() => router.push(`/church/${myChurch.id}`)}
                        className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-amber-50 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-100"
                      >
                        ⛪ View Church Profile
                      </button>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => router.push(`/church/${myChurch.id}/members`)}
                          className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-50 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-100"
                        >
                          👥 Members
                        </button>
                        <button
                          onClick={() => router.push(`/church/${myChurch.id}/tithe`)}
                          className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                        >
                          💝 Tithing
                        </button>
                        <button
                          onClick={() => router.push(`/church/${myChurch.id}/prayers`)}
                          className="flex items-center justify-center gap-1.5 rounded-xl bg-purple-50 py-2.5 text-sm font-semibold text-purple-700 hover:bg-purple-100"
                        >
                          🙏 Prayer Wall
                        </button>
                        <button
                          onClick={() => router.push(`/church/${myChurch.id}/events`)}
                          className="flex items-center justify-center gap-1.5 rounded-xl bg-rose-50 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                        >
                          📅 Events
                        </button>
                        <button
                          onClick={() => router.push(`/church/${myChurch.id}/devotionals`)}
                          className="flex items-center justify-center gap-1.5 rounded-xl bg-teal-50 py-2.5 text-sm font-semibold text-teal-700 hover:bg-teal-100 col-span-2"
                        >
                          📖 Devotionals
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-6 space-y-3 text-sm text-gray-700">
                    <p><span className="font-semibold">City:</span> {isChurchAdmin ? (myChurch?.city || "—") : (profile.city || "—")}</p>
                    <p><span className="font-semibold">Country:</span> {isChurchAdmin ? (myChurch?.country || "—") : (profile.country || "—")}</p>
                    {!isChurchAdmin && (
                      <p>
                        <span className="font-semibold">Church:</span>{" "}
                        {profile.church_id ? (
                          <button
                            onClick={() => router.push(`/church/${profile.church_id}`)}
                            className="text-amber-600 font-medium hover:underline"
                          >
                            {memberChurchName || "View Church"}
                          </button>
                        ) : "—"}
                      </p>
                    )}
                    {isChurchAdmin && myChurch?.email && (
                      <p>
                        <span className="font-semibold">Email:</span>{" "}
                        <a href={`mailto:${myChurch.email}`} className="text-brand-500 hover:underline">{myChurch.email}</a>
                      </p>
                    )}
                    {isChurchAdmin && myChurch?.phone && (
                      <p>
                        <span className="font-semibold">Phone:</span>{" "}
                        <a href={`tel:${myChurch.phone}`} className="text-brand-500 hover:underline">{myChurch.phone}</a>
                      </p>
                    )}
                    <p><span className="font-semibold">Bio:</span> {isChurchAdmin ? (myChurch?.description || "—") : (profile.bio || "—")}</p>
                  </div>
                </>
              )}

              {/* ── EDIT MODE ── */}
              {isEditing && (
                <>
                  <h1 className="text-center text-2xl font-bold text-gray-900">{t("profile_edit")}</h1>

                  <div className="mt-6 flex flex-col items-center">
                    <div className="relative">
                      {profile.avatar_url ? (
                        <img src={profile.avatar_url} alt="Profile" className="h-28 w-28 rounded-full border object-cover" />
                      ) : (
                        <div className="flex h-28 w-28 items-center justify-center rounded-full border bg-gray-200 text-4xl font-bold text-gray-600">
                          {avatarLetter}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-2xl text-white shadow"
                      >
                        +
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }}
                      />
                    </div>
                    {uploading && <p className="mt-2 text-sm text-gray-500">Uploading photo...</p>}
                  </div>

                  <div className="mt-6 grid gap-4">

                    {isChurchAdmin ? (
                      <>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">Church Name</label>
                          <input
                            value={churchName}
                            onChange={(e) => setChurchName(e.target.value)}
                            className="w-full rounded-lg border px-3 py-2"
                            placeholder="Enter church name"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">Pastor Name</label>
                          <input
                            value={pastorName}
                            onChange={(e) => setPastorName(e.target.value)}
                            className="w-full rounded-lg border px-3 py-2"
                            placeholder="Enter pastor name"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                          <input
                            type="email"
                            value={churchEmail}
                            onChange={(e) => setChurchEmail(e.target.value)}
                            className="w-full rounded-lg border px-3 py-2"
                            placeholder="church@example.com"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
                          <input
                            type="tel"
                            value={churchPhone}
                            onChange={(e) => setChurchPhone(e.target.value)}
                            className="w-full rounded-lg border px-3 py-2"
                            placeholder="+1 234 567 8900"
                          />
                        </div>
                      </>
                    ) : (
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Full Name</label>
                        <input
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="w-full rounded-lg border px-3 py-2"
                        />
                      </div>
                    )}

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">City</label>
                      <input
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Country</label>
                      <input
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2"
                      />
                    </div>

                    {!isChurchAdmin && (
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Church</label>
                        <select
                          value={churchId}
                          onChange={(e) => setChurchId(e.target.value)}
                          className="w-full rounded-lg border px-3 py-2"
                        >
                          <option value="">Select a church</option>
                          {churchOptions.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}{c.city ? ` — ${c.city}` : ""}{c.country ? `, ${c.country}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Bio</label>
                      <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        rows={3}
                        className="w-full rounded-lg border px-3 py-2"
                        placeholder="Small text that defines you..."
                      />
                    </div>

                  </div>

                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={cancelEdit}
                      className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      {t("profile_cancel")}
                    </button>
                    <button
                      onClick={saveProfile}
                      disabled={saving}
                      className="flex-1 rounded-xl bg-brand-600 px-4 py-3 text-sm font-medium text-white disabled:bg-brand-400"
                    >
                      {saving ? "…" : t("profile_save")}
                    </button>
                  </div>
                </>
              )}

            </div>
          </section>

          {/* ── Right sidebar ── */}
          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-[72px] space-y-3">

              {/* Stats */}
              <Card>
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">Stats</p>
                <div className="flex gap-2">
                  <div className="flex-1 rounded-xl bg-gray-50 p-3 text-center">
                    <p className="text-2xl font-bold text-gray-900">{followersCount}</p>
                    <p className="text-xs text-gray-500">Followers</p>
                  </div>
                  <div className="flex-1 rounded-xl bg-gray-50 p-3 text-center">
                    <p className="text-2xl font-bold text-gray-900">{followingCount}</p>
                    <p className="text-xs text-gray-500">Following</p>
                  </div>
                </div>
              </Card>

              {/* Location */}
              {(isChurchAdmin ? myChurch?.city || myChurch?.country : profile.city || profile.country) && (
                <Card>
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">Location</p>
                  <p className="flex items-center gap-2 text-sm text-gray-700">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-gray-400">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
                    </svg>
                    {isChurchAdmin
                      ? [myChurch?.city, myChurch?.country].filter(Boolean).join(", ")
                      : [profile.city, profile.country].filter(Boolean).join(", ")}
                  </p>
                </Card>
              )}

              {/* Member church link (for regular members) */}
              {!isChurchAdmin && memberChurch && (
                <Card>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">My Church</p>
                  <button
                    onClick={() => router.push(`/church/${memberChurch.id}`)}
                    className="w-full text-left"
                  >
                    <p className="text-sm font-semibold text-amber-600 hover:underline">{memberChurch.name}</p>
                    {(memberChurch.city || memberChurch.country) && (
                      <p className="mt-0.5 text-xs text-gray-400">
                        {[memberChurch.city, memberChurch.country].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </button>
                </Card>
              )}

              {/* Church admin: tithe summary shortcut */}
              {isChurchAdmin && myChurch && (
                <Card>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Quick Links</p>
                  <button
                    onClick={() => router.push(`/church/${myChurch.id}/tithe`)}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
                  >
                    💝 Tithe Records
                  </button>
                  <button
                    onClick={() => router.push(`/church/${myChurch.id}/events`)}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
                  >
                    📅 Manage Events
                  </button>
                  <button
                    onClick={() => router.push(`/church/${myChurch.id}/devotionals`)}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50"
                  >
                    📖 Post Devotional
                  </button>
                </Card>
              )}

            </div>
          </aside>

        </div>
      </div>

      <div className="lg:hidden">
        <BottomNav />
      </div>

      {followModal && profile && (
        <FollowListModal
          targetUserId={profile.id}
          type={followModal}
          currentUserId={profile.id}
          onClose={() => setFollowModal(null)}
        />
      )}
    </main>
  );
}
