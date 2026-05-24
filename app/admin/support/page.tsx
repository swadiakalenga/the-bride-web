"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../../lib/supabase";
import { useLanguage } from "../../../lib/useLanguage";
import { createNotification } from "../../../lib/notificationPush";

const STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

const STATUS_COLORS: Record<string, string> = {
  open:        "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  resolved:    "bg-emerald-100 text-emerald-700",
  closed:      "bg-gray-100 text-gray-600",
};

const PRIORITY_COLORS: Record<string, string> = {
  low:    "bg-gray-100 text-gray-600",
  normal: "bg-blue-100 text-blue-700",
  high:   "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

const CATEGORY_LABELS: Record<string, string> = {
  bug:             "Bug / Error",
  payment:         "Payment",
  live_stream:     "Live Stream",
  account:         "Account",
  church:          "Church",
  messaging:       "Messaging",
  feature_request: "Feature Request",
  other:           "Other",
};

type TicketRow = {
  id: string;
  user_id: string | null;
  email: string | null;
  category: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  admin_response: string | null;
  assigned_to: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  user_name: string | null;
};

export default function AdminSupportPage() {
  const { lang } = useLanguage();
  const isFr = lang === "fr";

  const [adminId, setAdminId] = useState<string | null>(null);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<TicketRow | null>(null);

  // Detail panel state
  const [editStatus, setEditStatus] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editResponse, setEditResponse] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setAdminId(user.id);
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("support_tickets")
      .select(`
        id, user_id, email, category, subject, message,
        status, priority, admin_response, assigned_to,
        resolved_at, created_at, updated_at,
        profiles!support_tickets_user_id_fkey(full_name)
      `)
      .order("created_at", { ascending: false })
      .limit(200);

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data, error: qErr } = await query;
    if (qErr) {
      setError(qErr.message);
    } else {
      const rows = (data ?? []).map((r: Record<string, unknown>) => ({
        ...(r as Omit<TicketRow, "user_name">),
        user_name: (r.profiles as { full_name: string | null } | null)?.full_name ?? null,
      }));
      setTickets(rows);
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openDetail = (ticket: TicketRow) => {
    setSelected(ticket);
    setEditStatus(ticket.status);
    setEditPriority(ticket.priority);
    setEditResponse(ticket.admin_response ?? "");
    setSaveMsg("");
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setSaveMsg("");

    const updates: Record<string, unknown> = {
      status:         editStatus,
      priority:       editPriority,
      admin_response: editResponse.trim() || null,
    };

    if (editStatus === "resolved" && selected.status !== "resolved") {
      updates.resolved_at = new Date().toISOString();
    }

    const { error: upErr } = await supabase
      .from("support_tickets")
      .update(updates)
      .eq("id", selected.id);

    if (upErr) {
      setSaveMsg(upErr.message);
      setSaving(false);
      return;
    }

    // Notify ticket owner if admin wrote a response and there's a user_id
    const responseChanged = editResponse.trim() !== (selected.admin_response ?? "").trim();
    if (responseChanged && editResponse.trim() && selected.user_id && adminId && selected.user_id !== adminId) {
      void createNotification({
        recipientUserId: selected.user_id,
        actorUserId:     adminId,
        type:            "support_response",
      });
    }

    // Update local state
    const updated: TicketRow = {
      ...selected,
      status:         editStatus,
      priority:       editPriority,
      admin_response: editResponse.trim() || null,
      resolved_at:    updates.resolved_at as string | null ?? selected.resolved_at,
    };
    setTickets((prev) => prev.map((t) => t.id === selected.id ? updated : t));
    setSelected(updated);
    setSaveMsg(isFr ? "Sauvegardé." : "Saved.");
    setSaving(false);
  };

  const handleAssignSelf = async () => {
    if (!selected || !adminId) return;
    setSaving(true);
    const { error: upErr } = await supabase
      .from("support_tickets")
      .update({ assigned_to: adminId })
      .eq("id", selected.id);
    if (!upErr) {
      const updated = { ...selected, assigned_to: adminId };
      setTickets((prev) => prev.map((t) => t.id === selected.id ? updated : t));
      setSelected(updated);
    }
    setSaving(false);
  };

  const shortId = (id: string) => id.slice(0, 8).toUpperCase();

  return (
    <div className="flex h-full gap-4">
      {/* ── Left: list ─────────────────────────────────────────── */}
      <div className={`flex flex-col gap-4 ${selected ? "hidden lg:flex lg:w-1/2" : "w-full"}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-gray-900">
            {isFr ? "Tickets de support" : "Support Tickets"}
          </h1>
          <button
            onClick={load}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            {isFr ? "Actualiser" : "Refresh"}
          </button>
        </div>

        {/* Status filter */}
        <div className="flex flex-wrap gap-2">
          {["all", ...STATUSES].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                statusFilter === s
                  ? "bg-amber-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s === "all" ? (isFr ? "Tous" : "All") : s.replace("_", " ")}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-7 w-7 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="rounded-2xl bg-gray-50 py-12 text-center text-sm text-gray-400">
            {isFr ? "Aucun ticket" : "No tickets"}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {tickets.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => openDetail(ticket)}
                className={`w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition-colors hover:bg-gray-50 ${
                  selected?.id === ticket.id ? "border-amber-400 ring-1 ring-amber-400" : "border-gray-200"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{ticket.subject}</p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      #{shortId(ticket.id)}
                      {" · "}
                      {ticket.user_name ?? ticket.email ?? "anonymous"}
                      {" · "}
                      {CATEGORY_LABELS[ticket.category] ?? ticket.category}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {new Date(ticket.created_at).toLocaleDateString(isFr ? "fr-FR" : "en-US")}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[ticket.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {ticket.status.replace("_", " ")}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${PRIORITY_COLORS[ticket.priority] ?? "bg-gray-100 text-gray-600"}`}>
                      {ticket.priority}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Right: detail panel ────────────────────────────────── */}
      {selected && (
        <div className="w-full overflow-y-auto lg:w-1/2">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            {/* Detail header */}
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div>
                <p className="text-xs font-mono text-gray-400">#{shortId(selected.id)}</p>
                <p className="mt-0.5 font-semibold text-gray-900">{selected.subject}</p>
                <p className="mt-0.5 text-xs text-gray-400">
                  {selected.user_name ?? selected.email ?? "anonymous"}
                  {" · "}
                  {CATEGORY_LABELS[selected.category] ?? selected.category}
                  {" · "}
                  {new Date(selected.created_at).toLocaleString(isFr ? "fr-FR" : "en-US")}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="shrink-0 rounded-full p-1 text-gray-400 hover:bg-gray-100"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="space-y-5 px-5 py-5">
              {/* User message */}
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  {isFr ? "Message" : "Message"}
                </p>
                <p className="whitespace-pre-wrap text-sm text-gray-800">{selected.message}</p>
              </div>

              {/* Status + Priority row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                    {isFr ? "Statut" : "Status"}
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s.replace("_", " ")}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                    {isFr ? "Priorité" : "Priority"}
                  </label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Admin response */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                  {isFr ? "Réponse admin" : "Admin response"}
                </label>
                <textarea
                  value={editResponse}
                  onChange={(e) => setEditResponse(e.target.value)}
                  rows={4}
                  placeholder={isFr ? "Écrire une réponse visible par l'utilisateur…" : "Write a response visible to the user…"}
                  className="w-full resize-none rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                />
              </div>

              {/* Action row */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  {saving ? "…" : (isFr ? "Sauvegarder" : "Save")}
                </button>

                {selected.assigned_to !== adminId && (
                  <button
                    onClick={handleAssignSelf}
                    disabled={saving}
                    className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {isFr ? "Assigner à moi" : "Assign to me"}
                  </button>
                )}

                {selected.assigned_to === adminId && (
                  <span className="text-xs text-gray-400">
                    {isFr ? "Assigné à vous" : "Assigned to you"}
                  </span>
                )}

                {editStatus !== "resolved" && (
                  <button
                    onClick={() => { setEditStatus("resolved"); }}
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
                  >
                    {isFr ? "Marquer résolu" : "Mark resolved"}
                  </button>
                )}

                {saveMsg && (
                  <span className={`text-xs ${saveMsg.includes("aveg") || saveMsg === "Saved." ? "text-emerald-600" : "text-red-600"}`}>
                    {saveMsg}
                  </span>
                )}
              </div>

              {/* Metadata */}
              <div className="rounded-xl bg-gray-50 px-4 py-3 text-xs text-gray-500 space-y-1">
                <p><span className="font-medium">ID:</span> {selected.id}</p>
                {selected.email && <p><span className="font-medium">Email:</span> {selected.email}</p>}
                {selected.resolved_at && (
                  <p><span className="font-medium">{isFr ? "Résolu le" : "Resolved"}:</span> {new Date(selected.resolved_at).toLocaleString()}</p>
                )}
                <p><span className="font-medium">{isFr ? "Mis à jour" : "Updated"}:</span> {new Date(selected.updated_at).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
