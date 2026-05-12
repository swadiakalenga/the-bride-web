"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import BottomNav from "../../../components/ui/BottomNav";
import type { ChurchEventWithRsvp, RsvpStatus } from "../../../../lib/types";

export default function ChurchEventsPage() {
  const params = useParams();
  const router = useRouter();
  const churchId = params.id as string;

  const [events, setEvents] = useState<ChurchEventWithRsvp[]>([]);
  const [churchName, setChurchName] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Create event form
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [location, setLocation] = useState("");
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

    const { data: eventsData } = await supabase
      .from("church_events")
      .select("*")
      .eq("church_id", churchId)
      .order("event_date", { ascending: true });

    if (eventsData && eventsData.length > 0) {
      const eventIds = eventsData.map((e) => e.id);
      const creatorIds = [...new Set(eventsData.filter((e) => e.created_by).map((e) => e.created_by!))];

      const creatorMap: Record<string, string> = {};
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", creatorIds);
        (profiles || []).forEach((p) => {
          creatorMap[p.id] = p.full_name || "Unknown";
        });
      }

      // Load RSVPs for these events
      const { data: rsvpData } = await supabase
        .from("event_rsvps")
        .select("event_id, user_id, status")
        .in("event_id", eventIds);

      const goingByEvent: Record<string, number> = {};
      const interestedByEvent: Record<string, number> = {};
      const myStatusByEvent: Record<string, RsvpStatus> = {};
      (rsvpData || []).forEach((r) => {
        if (r.status === "going") goingByEvent[r.event_id] = (goingByEvent[r.event_id] || 0) + 1;
        if (r.status === "interested") interestedByEvent[r.event_id] = (interestedByEvent[r.event_id] || 0) + 1;
        if (r.user_id === me) myStatusByEvent[r.event_id] = r.status as RsvpStatus;
      });

      setEvents(eventsData.map((e) => ({
        ...e,
        creator_name: e.created_by ? creatorMap[e.created_by] || null : null,
        going_count: goingByEvent[e.id] || 0,
        interested_count: interestedByEvent[e.id] || 0,
        my_status: myStatusByEvent[e.id] || null,
      })));
    } else {
      setEvents([]);
    }

    setLoading(false);
  }

  const submitEvent = async () => {
    if (!currentUserId || !title.trim() || !eventDate) return;
    setSubmitting(true);

    const dateTime = eventTime
      ? `${eventDate}T${eventTime}:00`
      : `${eventDate}T00:00:00`;

    await supabase.from("church_events").insert([{
      church_id: churchId,
      title: title.trim(),
      description: description.trim() || null,
      event_date: dateTime,
      location: location.trim() || null,
      created_by: currentUserId,
    }]);

    setTitle("");
    setDescription("");
    setEventDate("");
    setEventTime("");
    setLocation("");
    setShowForm(false);
    setSubmitting(false);
    loadPage();
  };

  const deleteEvent = async (eventId: string) => {
    if (!confirm("Delete this event?")) return;
    await supabase.from("church_events").delete().eq("id", eventId);
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
  };

  const setRsvp = async (eventId: string, next: RsvpStatus) => {
    if (!currentUserId) return;
    const event = events.find((e) => e.id === eventId);
    if (!event) return;
    const previous = event.my_status || null;
    const isToggleOff = previous === next;
    const newStatus: RsvpStatus | null = isToggleOff ? null : next;

    // Optimistic update
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== eventId) return e;
        let going = e.going_count || 0;
        let interested = e.interested_count || 0;
        if (previous === "going") going = Math.max(0, going - 1);
        if (previous === "interested") interested = Math.max(0, interested - 1);
        if (newStatus === "going") going += 1;
        if (newStatus === "interested") interested += 1;
        return { ...e, going_count: going, interested_count: interested, my_status: newStatus };
      })
    );

    if (isToggleOff) {
      await supabase
        .from("event_rsvps")
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", currentUserId);
    } else {
      await supabase
        .from("event_rsvps")
        .upsert(
          { event_id: eventId, user_id: currentUserId, status: next },
          { onConflict: "event_id,user_id" }
        );
    }
  };

  const isUpcoming = (dateStr: string) => new Date(dateStr) >= new Date();
  const upcomingEvents = events.filter((e) => isUpcoming(e.event_date));
  const pastEvents = events.filter((e) => !isUpcoming(e.event_date));

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    if (d.getHours() === 0 && d.getMinutes() === 0) return null;
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Events</h1>
              <p className="text-xs text-gray-400">{churchName}</p>
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500"
            >
              {showForm ? "Cancel" : "+ New Event"}
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg px-4 pt-4">
        {showForm && (
          <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Create New Event</h2>
            <div className="space-y-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Event title *"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-amber-300 focus:bg-white"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                rows={3}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-amber-300 focus:bg-white"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Date *</label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-amber-300 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Time</label>
                  <input
                    type="time"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-amber-300 focus:bg-white"
                  />
                </div>
              </div>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Location (optional)"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-amber-300 focus:bg-white"
              />
              <button
                onClick={submitEvent}
                disabled={submitting || !title.trim() || !eventDate}
                className="w-full rounded-full bg-amber-400 py-3 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Create Event"}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="mt-8 flex justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" /></div>
        ) : events.length === 0 ? (
          <div className="mt-8 text-center">
            <p className="text-4xl mb-2">📅</p>
            <p className="font-semibold text-gray-700">No events yet</p>
            <p className="text-sm text-gray-400 mt-1">
              {isAdmin ? "Create the first event for your church." : "Check back for upcoming church events."}
            </p>
          </div>
        ) : (
          <>
            {upcomingEvents.length > 0 && (
              <div className="mb-6">
                <h2 className="mb-3 text-sm font-bold text-gray-600 uppercase tracking-wide">Upcoming</h2>
                <div className="space-y-3">
                  {upcomingEvents.map((event) => (
                    <div key={event.id} className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100">
                      <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 flex-shrink-0 flex-col items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                          <span className="text-xs font-bold uppercase leading-none">
                            {new Date(event.event_date).toLocaleDateString("en-US", { month: "short" })}
                          </span>
                          <span className="text-lg font-bold leading-none mt-0.5">
                            {new Date(event.event_date).getDate()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-gray-900">{event.title}</h3>
                          {event.description && (
                            <p className="mt-1 text-sm text-gray-600 line-clamp-2">{event.description}</p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-400">
                            <span>{formatDate(event.event_date)}</span>
                            {formatTime(event.event_date) && (
                              <span>· {formatTime(event.event_date)}</span>
                            )}
                            {event.location && (
                              <span>· 📍 {event.location}</span>
                            )}
                          </div>

                          {/* RSVP controls */}
                          <div className="mt-3 flex items-center gap-2">
                            <button
                              onClick={() => setRsvp(event.id, "going")}
                              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                event.my_status === "going"
                                  ? "bg-amber-400 text-white hover:bg-amber-500"
                                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                              }`}
                            >
                              ✓ Going {event.going_count ? `· ${event.going_count}` : ""}
                            </button>
                            <button
                              onClick={() => setRsvp(event.id, "interested")}
                              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                event.my_status === "interested"
                                  ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                              }`}
                            >
                              ★ Interested {event.interested_count ? `· ${event.interested_count}` : ""}
                            </button>
                          </div>
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => deleteEvent(event.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500"
                            title="Delete event"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pastEvents.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-bold text-gray-400 uppercase tracking-wide">Past Events</h2>
                <div className="space-y-3">
                  {pastEvents.map((event) => (
                    <div key={event.id} className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100 opacity-60">
                      <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 flex-shrink-0 flex-col items-center justify-center rounded-xl bg-gray-50 text-gray-400">
                          <span className="text-xs font-bold uppercase leading-none">
                            {new Date(event.event_date).toLocaleDateString("en-US", { month: "short" })}
                          </span>
                          <span className="text-lg font-bold leading-none mt-0.5">
                            {new Date(event.event_date).getDate()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-gray-700">{event.title}</h3>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-400">
                            <span>{formatDate(event.event_date)}</span>
                            {event.location && <span>· 📍 {event.location}</span>}
                            {!!event.going_count && <span>· {event.going_count} went</span>}
                          </div>
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => deleteEvent(event.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500"
                            title="Delete event"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
