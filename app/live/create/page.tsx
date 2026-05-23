"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";

// useSearchParams must be inside a Suspense boundary for static export.
export default function ScheduleStreamPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gray-50"><div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" /></div>}>
      <ScheduleStreamForm />
    </Suspense>
  );
}

function ScheduleStreamForm() {
  const router       = useRouter();
  const params       = useSearchParams();
  const churchId     = params.get("church") ?? "";

  const [title, setTitle]             = useState("");
  const [description, setDescription] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !churchId) return;
    setSubmitting(true);
    setError(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError("Not logged in."); setSubmitting(false); return; }

    const body: Record<string, string> = { churchId, title: title.trim() };
    if (description.trim()) body.description = description.trim();
    if (scheduledFor)        body.scheduledFor = scheduledFor;

    const res = await fetch("/api/live/create-mux-stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });

    const json = await res.json() as { eventId?: string; error?: string };

    if (!res.ok || !json.eventId) {
      setError(json.error ?? "Failed to create stream. Check Mux env vars.");
      setSubmitting(false);
      return;
    }

    router.push(`/live/${json.eventId}`);
  };

  if (!churchId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-red-500">Missing church ID. Go back and try again.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Schedule Stream</h1>
            <p className="text-xs text-gray-400">Mux will be configured automatically</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">
              Stream title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sunday Morning Service"
              required
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">
              Description <span className="text-xs font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What will you be streaming about?"
              rows={3}
              className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          {/* Scheduled for */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">
              Scheduled date &amp; time <span className="text-xs font-normal text-gray-400">(optional)</span>
            </label>
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          {/* Info */}
          <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-xs text-amber-700 space-y-1">
            <p className="font-semibold">What happens next</p>
            <p>TheBride will create a live stream in Mux and generate your stream key. You&apos;ll see the RTMP server address and key on the next screen.</p>
          </div>

          <button
            type="submit"
            disabled={submitting || !title.trim()}
            className="w-full rounded-xl bg-red-600 py-3.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {submitting ? "Creating stream…" : "Create Stream"}
          </button>
        </form>
      </div>
    </div>
  );
}
