"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import BottomNav from "../components/ui/BottomNav";
import EmptyState from "../components/ui/EmptyState";

type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  country: string | null;
};

type Church = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
};

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"people" | "churches">("people");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [people, setPeople] = useState<Profile[]>([]);
  const [churches, setChurches] = useState<Church[]>([]);
  const [followedChurchIds, setFollowedChurchIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [uiMessage, setUiMessage] = useState("");

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    searchAll();
  }, [query, currentUserId]);

  async function loadCurrentUser() {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id || null;
    setCurrentUserId(uid);

    if (!uid) {
      setLoading(false);
      return;
    }

    const { data: churchFollowData } = await supabase
      .from("church_follows")
      .select("church_id")
      .eq("user_id", uid);

    setFollowedChurchIds((churchFollowData || []).map((row) => row.church_id));
    setLoading(false);
  }

  async function searchAll() {
    setUiMessage("");
    const trimmedQuery = query.trim();

    const profileQuery = supabase
      .from("profiles")
      .select("id, full_name, avatar_url, city, country")
      .order("full_name", { ascending: true })
      .limit(24);

    const churchQuery = supabase
      .from("churches")
      .select("id, name, city, country")
      .order("name", { ascending: true })
      .limit(24);

    const [{ data: peopleData, error: peopleError }, { data: churchData, error: churchError }] =
      trimmedQuery
        ? await Promise.all([
            profileQuery.ilike("full_name", `%${trimmedQuery}%`),
            churchQuery.ilike("name", `%${trimmedQuery}%`),
          ])
        : await Promise.all([profileQuery, churchQuery]);

    if (peopleError || churchError) {
      setUiMessage((peopleError || churchError)?.message || "Search failed.");
    }

    setPeople((peopleData || []).filter((person) => person.id !== currentUserId));
    setChurches(churchData || []);
  }

  const toggleChurchFollow = async (churchId: string) => {
    if (!currentUserId) {
      router.push("/login");
      return;
    }

    setUiMessage("");
    const isFollowing = followedChurchIds.includes(churchId);

    if (isFollowing) {
      const { error } = await supabase
        .from("church_follows")
        .delete()
        .eq("user_id", currentUserId)
        .eq("church_id", churchId);

      if (error) {
        setUiMessage(error.message);
        return;
      }

      setFollowedChurchIds((prev) => prev.filter((id) => id !== churchId));
    } else {
      const { error } = await supabase.from("church_follows").insert([
        {
          user_id: currentUserId,
          church_id: churchId,
        },
      ]);

      if (error) {
        setUiMessage(error.message);
        return;
      }

      setFollowedChurchIds((prev) => [...prev, churchId]);
    }
  };

  const renderPersonAvatar = (profile: Profile) => {
    if (profile.avatar_url) {
      return (
        <img
          src={profile.avatar_url}
          alt={profile.full_name || "User"}
          className="h-12 w-12 rounded-full border border-gray-200 object-cover"
        />
      );
    }

    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-lg font-bold text-white">
        {(profile.full_name || "U").charAt(0).toUpperCase()}
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto w-full max-w-2xl px-4 py-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900">Discover</h1>
            <div className="min-w-0 flex-1">
              <input
                type="text"
                placeholder="Search people or churches"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full rounded-full border border-gray-200 bg-gray-100 px-4 py-2.5 text-sm outline-none transition focus:border-amber-300 focus:bg-white"
              />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 rounded-full bg-gray-100 p-1 text-sm font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab("people")}
              className={`rounded-full py-2 transition ${activeTab === "people" ? "bg-white text-amber-600 shadow-sm" : "text-gray-500"}`}
            >
              People
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("churches")}
              className={`rounded-full py-2 transition ${activeTab === "churches" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"}`}
            >
              Churches
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl px-4 pt-4">
        {uiMessage && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {uiMessage}
          </div>
        )}

        {loading ? (
          <div className="py-10 text-center text-sm text-gray-500">Loading discovery...</div>
        ) : activeTab === "people" ? (
          people.length === 0 ? (
            <EmptyState
              title="No people found"
              description="Try a different name or check back as the community grows."
            />
          ) : (
            <div className="space-y-3">
              {people.map((person) => (
                <button
                  key={person.id}
                  onClick={() => router.push(`/user/${person.id}`)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  {renderPersonAvatar(person)}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900">{person.full_name || "Unknown"}</p>
                    <p className="truncate text-sm text-gray-500">
                      {[person.city, person.country].filter(Boolean).join(", ") || "Member of TheBride"}
                    </p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                    View
                  </span>
                </button>
              ))}
            </div>
          )
        ) : churches.length === 0 ? (
          <EmptyState
            title="No churches found"
            description="Try another church name or city."
          />
        ) : (
          <div className="space-y-3">
            {churches.map((church) => {
              const isFollowing = followedChurchIds.includes(church.id);

              return (
                <div
                  key={church.id}
                  className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:shadow-md"
                >
                  <button
                    type="button"
                    onClick={() => router.push(`/church/${church.id}`)}
                    className="flex w-full items-center gap-3 text-left"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 font-bold text-blue-600">
                      {church.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-gray-900">{church.name}</p>
                      <p className="truncate text-sm text-gray-500">
                        {[church.city, church.country].filter(Boolean).join(", ") || "Church community"}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleChurchFollow(church.id)}
                    className={`mt-3 w-full rounded-full px-3 py-2 text-sm font-semibold transition ${isFollowing ? "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50" : "bg-blue-500 text-white hover:bg-blue-600"}`}
                  >
                    {isFollowing ? "Following" : "Follow church"}
                  </button>
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
