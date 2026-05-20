"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../../lib/supabase";
import { useLanguage } from "../../../lib/useLanguage";

type UserRow = {
  id: string;
  full_name: string | null;
  role: string;
  account_type: string | null;
  church_id: string | null;
  city: string | null;
  country: string | null;
  created_at: string;
  email: string;
};

const ROLES = ["member", "church_admin"] as const;

export default function AdminUsersPage() {
  const { t } = useLanguage();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: rpcError } = await supabase.rpc("admin_list_users", {
      p_search: debouncedSearch || null,
      p_limit: 100,
      p_offset: 0,
    });
    if (rpcError) setError(rpcError.message);
    else setUsers((data as UserRow[]) ?? []);
    setLoading(false);
  }, [debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  const changeRole = async (user: UserRow, newRole: string) => {
    setSavingId(user.id);
    const { error: rpcError } = await supabase.rpc("admin_set_user_role", {
      p_user_id: user.id,
      p_role: newRole,
    });
    if (rpcError) setError(rpcError.message);
    else setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, role: newRole } : u));
    setSavingId(null);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">{t("admin_users_title")}</h1>

      <input
        type="search"
        placeholder={t("admin_users_search")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
      />

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3">{t("admin_users_name")}</th>
                <th className="px-4 py-3">{t("admin_users_email")}</th>
                <th className="px-4 py-3">{t("admin_users_role")}</th>
                <th className="px-4 py-3">{t("admin_users_type")}</th>
                <th className="px-4 py-3">{t("admin_users_joined")}</th>
                <th className="px-4 py-3">{t("admin_users_change_role")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{u.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      u.role === "platform_admin"
                        ? "bg-purple-100 text-purple-700"
                        : u.role === "church_admin"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-gray-100 text-gray-600"
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.account_type ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {u.role !== "platform_admin" && (
                      <select
                        value={u.role}
                        disabled={savingId === u.id}
                        onChange={(e) => changeRole(u, e.target.value)}
                        className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-xs outline-none focus:border-amber-400 disabled:opacity-50"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    {t("admin_no_data")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
