"use client";

import Link from "next/link";
import { useLanguage } from "../../../lib/useLanguage";

export default function AdminDonationsPage() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t("admin_donations_title")}</h1>

      <div className="rounded-2xl bg-white p-8 shadow-sm text-center space-y-3">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
            <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </div>
        <p className="font-semibold text-gray-700">{t("admin_donations_desc")}</p>
        <p className="text-sm text-gray-400">
          Les dons actuels transitent par virement bancaire ou Mobile Money.
          Consultez la politique de dons pour les détails.
        </p>
        <Link
          href="/legal/donation-policy"
          className="inline-block rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
        >
          Politique de dons
        </Link>
      </div>
    </div>
  );
}
