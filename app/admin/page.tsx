"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { useLanguage } from "../../lib/useLanguage";

type KPIRow = {
  total_users: number;
  active_users_today: number;
  active_users_week: number;
  total_churches: number;
  posts_today: number;
  messages_today: number;
  donations_total_cents: number;
  open_support_tickets: number;
  pending_reports: number;
  active_live_streams: number;
  pending_verifications: number;
};

type KPICard = {
  label: string;
  value: string;
  color: string;
  bg: string;
  icon: string;
  href?: string;
};

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtCents(cents: number) {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(1)}k`;
  return `$${dollars.toFixed(2)}`;
}

function KPICard({ card }: { card: KPICard }) {
  const inner = (
    <div className={`rounded-2xl ${card.bg} p-5 border border-white/60 shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{card.label}</p>
          <p className={`mt-1.5 text-3xl font-bold tabular-nums ${card.color}`}>{card.value}</p>
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${card.color.replace("text-", "bg-").replace("-600", "-100").replace("-700", "-100")}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={card.color}>
            <path d={card.icon} />
          </svg>
        </div>
      </div>
    </div>
  );

  return card.href ? (
    <Link href={card.href} className="block">{inner}</Link>
  ) : (
    <div>{inner}</div>
  );
}

export default function AdminOverviewPage() {
  const { lang } = useLanguage();
  const isFr = lang === "fr";

  const [kpi, setKpi] = useState<KPIRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error: rpcError } = await supabase.rpc("admin_get_kpis");
      if (rpcError) {
        // Fall back to old stats RPC if new one not yet deployed
        const { data: old, error: oldErr } = await supabase.rpc("admin_get_stats");
        if (oldErr) { setError(oldErr.message); }
        else if (old) {
          const o = old as Record<string, number>;
          setKpi({
            total_users: o.total_users ?? 0,
            active_users_today: 0,
            active_users_week: 0,
            total_churches: o.total_churches ?? 0,
            posts_today: 0,
            messages_today: 0,
            donations_total_cents: 0,
            open_support_tickets: 0,
            pending_reports: o.pending_reports ?? 0,
            active_live_streams: 0,
            pending_verifications: o.pending_verifications ?? 0,
          });
        }
      } else {
        setKpi(data as KPIRow);
      }
      setLoading(false);
    })();
  }, []);

  const cards: KPICard[] = kpi
    ? [
        {
          label: isFr ? "Utilisateurs" : "Total Users",
          value: fmt(kpi.total_users),
          color: "text-brand-600",
          bg: "bg-brand-50",
          icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
          href: "/admin/users",
        },
        {
          label: isFr ? "Actifs aujourd'hui" : "Active Today",
          value: fmt(kpi.active_users_today),
          color: "text-emerald-600",
          bg: "bg-emerald-50",
          icon: "M13 10V3L4 14h7v7l9-11h-7z",
        },
        {
          label: isFr ? "Actifs cette semaine" : "Active This Week",
          value: fmt(kpi.active_users_week),
          color: "text-teal-600",
          bg: "bg-teal-50",
          icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
        },
        {
          label: isFr ? "Églises" : "Churches",
          value: fmt(kpi.total_churches),
          color: "text-sky-600",
          bg: "bg-sky-50",
          icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
          href: "/admin/churches",
        },
        {
          label: isFr ? "Posts aujourd'hui" : "Posts Today",
          value: fmt(kpi.posts_today),
          color: "text-violet-600",
          bg: "bg-violet-50",
          icon: "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z",
          href: "/admin/posts",
        },
        {
          label: isFr ? "Messages aujourd'hui" : "Messages Today",
          value: fmt(kpi.messages_today),
          color: "text-indigo-600",
          bg: "bg-indigo-50",
          icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z",
        },
        {
          label: isFr ? "Total dons" : "Donations Total",
          value: fmtCents(kpi.donations_total_cents),
          color: "text-amber-600",
          bg: "bg-amber-50",
          icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
          href: "/admin/donations",
        },
        {
          label: isFr ? "Tickets ouverts" : "Open Tickets",
          value: fmt(kpi.open_support_tickets),
          color: kpi.open_support_tickets > 0 ? "text-orange-600" : "text-gray-500",
          bg: kpi.open_support_tickets > 0 ? "bg-orange-50" : "bg-gray-50",
          icon: "M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z",
          href: "/admin/support",
        },
        {
          label: isFr ? "Signalements en attente" : "Pending Reports",
          value: fmt(kpi.pending_reports),
          color: kpi.pending_reports > 0 ? "text-red-600" : "text-gray-500",
          bg: kpi.pending_reports > 0 ? "bg-red-50" : "bg-gray-50",
          icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
          href: "/admin/reports",
        },
        {
          label: isFr ? "Lives actifs" : "Active Livestreams",
          value: fmt(kpi.active_live_streams),
          color: kpi.active_live_streams > 0 ? "text-rose-600" : "text-gray-500",
          bg: kpi.active_live_streams > 0 ? "bg-rose-50" : "bg-gray-50",
          icon: "M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z",
        },
      ]
    : [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isFr ? "Vue d'ensemble" : "Platform Overview"}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {isFr
              ? "Métriques en temps réel de la plateforme TheBride"
              : "Real-time metrics for the TheBride platform"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/analytics"
            className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
            {isFr ? "Analytiques" : "Analytics"}
          </Link>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-200">
            Platform Admin
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600">{error}</div>
      )}

      {/* KPI grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {cards.map((card) => (
            <KPICard key={card.label} card={card} />
          ))}
        </div>
      )}

      {/* Quick nav */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          {isFr ? "Navigation rapide" : "Quick navigation"}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { href: "/admin/users",         label: isFr ? "Utilisateurs" : "Users",         color: "text-brand-600",   bg: "bg-brand-50"   },
            { href: "/admin/churches",      label: isFr ? "Églises" : "Churches",            color: "text-sky-600",     bg: "bg-sky-50"     },
            { href: "/admin/support",       label: "Support",                                 color: "text-orange-600",  bg: "bg-orange-50"  },
            { href: "/admin/donations",     label: isFr ? "Dons" : "Donations",              color: "text-amber-600",   bg: "bg-amber-50"   },
            { href: "/admin/reports",       label: isFr ? "Signalements" : "Reports",        color: "text-red-600",     bg: "bg-red-50"     },
            { href: "/admin/verifications", label: isFr ? "Vérifications" : "Verifications", color: "text-teal-600",    bg: "bg-teal-50"    },
            { href: "/admin/analytics",     label: isFr ? "Analytiques" : "Analytics",       color: "text-violet-600",  bg: "bg-violet-50"  },
            { href: "/admin/settings",      label: isFr ? "Paramètres" : "Settings",         color: "text-gray-700",    bg: "bg-gray-100"   },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center rounded-2xl border border-gray-100 ${link.bg} px-4 py-3 transition-opacity hover:opacity-75`}
            >
              <span className={`text-sm font-semibold ${link.color}`}>{link.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
