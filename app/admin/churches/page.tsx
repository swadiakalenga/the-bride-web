"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { useLanguage } from "../../../lib/useLanguage";

type ChurchRow = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  pastor_name: string | null;
  admin_user_id: string | null;
  admin_name: string | null;
  verification_status: string;
  created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  verified: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  rejected: "bg-red-100 text-red-600",
  unverified: "bg-gray-100 text-gray-500",
};

export default function AdminChurchesPage() {
  const { t } = useLanguage();
  const [churches, setChurches] = useState<ChurchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error: rpcError } = await supabase.rpc("admin_list_churches", {
        p_limit: 100,
        p_offset: 0,
      });
      if (rpcError) setError(rpcError.message);
      else setChurches((data as ChurchRow[]) ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">{t("admin_churches_title")}</h1>

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
                <th className="px-4 py-3">{t("admin_churches_name")}</th>
                <th className="px-4 py-3">Pasteur</th>
                <th className="px-4 py-3">{t("admin_churches_admin")}</th>
                <th className="px-4 py-3">Ville / Pays</th>
                <th className="px-4 py-3">{t("admin_churches_status")}</th>
                <th className="px-4 py-3">{t("admin_churches_created")}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {churches.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3 text-gray-500">{c.pastor_name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{c.admin_name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400">
                    {[c.city, c.country].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[c.verification_status] ?? STATUS_COLORS.unverified}`}>
                      {c.verification_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/church/${c.id}`}
                      className="text-xs font-medium text-amber-600 hover:underline"
                    >
                      {t("common_view")}
                    </Link>
                  </td>
                </tr>
              ))}
              {churches.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
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
