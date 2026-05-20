"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import Card from "../ui/Card";

type SuggestedPerson = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

type SuggestedChurch = {
  id: string;
  name: string;
};

type LiveStream = {
  id: string;
  title: string;
  church_name: string | null;
  church_avatar: string | null;
  viewer_count: number;
};

type Props = {
  currentUserId: string | null;
  liveStreams: LiveStream[];
};

export default function RightSidebar({ currentUserId, liveStreams }: Props) {
  const router = useRouter();
  const [suggestedPeople, setSuggestedPeople] = useState<SuggestedPerson[]>([]);
  const [suggestedChurches, setSuggestedChurches] = useState<SuggestedChurch[]>([]);

  useEffect(() => {
    if (!currentUserId) return;
    const userId = currentUserId;

    async function run() {
      const { data: followData } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId);

      const alreadyFollowing = new Set(
        (followData || []).map((f: { following_id: string }) => f.following_id)
      );
      alreadyFollowing.add(userId);

      const { data: people } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .neq("role", "church_admin")
        .order("created_at", { ascending: false })
        .limit(20);

      setSuggestedPeople(
        (people || [])
          .filter((p: SuggestedPerson) => !alreadyFollowing.has(p.id))
          .slice(0, 4)
      );

      const { data: churchFollowData } = await supabase
        .from("church_follows")
        .select("church_id")
        .eq("user_id", userId);

      const followedChurchIds = new Set(
        (churchFollowData || []).map((f: { church_id: string }) => f.church_id)
      );

      const { data: churches } = await supabase
        .from("churches")
        .select("id, name")
        .limit(20);

      setSuggestedChurches(
        (churches || [])
          .filter((c: SuggestedChurch) => !followedChurchIds.has(c.id))
          .slice(0, 3)
      );
    }

    run();
  }, [currentUserId]);

  return (
    <div className="space-y-3">
      {/* Live Now */}
      {liveStreams.length > 0 && (
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            <h3 className="text-xs font-bold uppercase tracking-wide text-red-600">Live Now</h3>
          </div>
          <div className="space-y-2">
            {liveStreams.slice(0, 3).map((stream) => (
              <button
                key={stream.id}
                onClick={() => router.push(`/live/${stream.id}`)}
                className="flex w-full items-center gap-2 rounded-xl p-1.5 text-left transition hover:bg-gray-50"
              >
                {stream.church_avatar ? (
                  <img
                    src={stream.church_avatar}
                    alt=""
                    className="h-9 w-9 rounded-full border-2 border-red-500 object-cover"
                  />
                ) : (
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-2 border-red-500 bg-gray-100 text-xs font-bold text-gray-600">
                    {(stream.church_name || "C").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-gray-900">{stream.church_name}</p>
                  <p className="truncate text-[11px] text-gray-500">{stream.title}</p>
                  <p className="text-[10px] text-gray-400">👁 {stream.viewer_count} watching</p>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Suggested people */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">People you may know</h3>
          <button
            onClick={() => router.push("/search")}
            className="text-xs text-amber-500 hover:underline"
          >
            See all
          </button>
        </div>
        {suggestedPeople.length === 0 ? (
          <p className="text-xs text-gray-400">No suggestions right now.</p>
        ) : (
          <div className="space-y-3">
            {suggestedPeople.map((person) => (
              <button
                key={person.id}
                onClick={() => router.push(`/user/${person.id}`)}
                className="flex w-full items-center gap-2 text-left transition hover:opacity-80"
              >
                {person.avatar_url ? (
                  <img
                    src={person.avatar_url}
                    alt={person.full_name || ""}
                    className="h-9 w-9 rounded-full border object-cover"
                  />
                ) : (
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-500">
                    {(person.full_name || "U").charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="flex-1 truncate text-sm font-medium text-gray-800">
                  {person.full_name || "Member"}
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Suggested churches */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">Suggested Churches</h3>
          <button
            onClick={() => router.push("/search")}
            className="text-xs text-brand-500 hover:underline"
          >
            See all
          </button>
        </div>
        {suggestedChurches.length === 0 ? (
          <p className="text-xs text-gray-400">No suggestions right now.</p>
        ) : (
          <div className="space-y-3">
            {suggestedChurches.map((church) => (
              <button
                key={church.id}
                onClick={() => router.push(`/church/${church.id}`)}
                className="flex w-full items-center gap-2 text-left transition hover:opacity-80"
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-500">
                  {church.name.charAt(0).toUpperCase()}
                </div>
                <span className="flex-1 truncate text-sm font-medium text-gray-800">
                  {church.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>

      <p className="px-2 text-[11px] text-gray-400">TheBride · Faith · Community</p>
    </div>
  );
}
