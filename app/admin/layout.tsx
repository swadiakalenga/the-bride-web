"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { useLanguage } from "../../lib/useLanguage";

const NAV_ITEMS = [
  { key: "admin_nav_overview", href: "/admin", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { key: "admin_nav_users", href: "/admin/users", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
  { key: "admin_nav_churches", href: "/admin/churches", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
  { key: "admin_nav_verifications", href: "/admin/verifications", icon: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" },
  { key: "admin_nav_reports", href: "/admin/reports", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" },
  { key: "admin_nav_posts", href: "/admin/posts", icon: "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" },
  { key: "admin_nav_payments", href: "/admin/payments", icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
  { key: "admin_nav_donations", href: "/admin/donations", icon: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" },
  { key: "admin_nav_payouts", href: "/admin/payouts", icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" },
  { key: "admin_nav_settings", href: "/admin/settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
  { key: "admin_nav_support",    href: "/admin/support",    icon: "M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" },
  { key: "admin_nav_analytics",  href: "/admin/analytics",  icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();
  const [checking, setChecking] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── DEBUG STATE ──────────────────────────────────────────────────
  const [debugRole, setDebugRole] = useState<string>("(loading)");
  const [debugUserId, setDebugUserId] = useState<string>("(loading)");
  const [debugProfileLoaded, setDebugProfileLoaded] = useState(false);
  const [debugError, setDebugError] = useState<string>("");
  const [debugAuthError, setDebugAuthError] = useState<string>("");
  // ────────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      // Step 1: get authenticated user
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) setDebugAuthError(authErr.message);

      if (!authData.user) {
        setDebugUserId("null — no session");
        setDebugRole("(no user)");
        router.replace("/login");
        return;
      }

      setDebugUserId(authData.user.id);

      // Step 2: fetch profile role
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", authData.user.id)
        .maybeSingle();

      setDebugProfileLoaded(true);

      if (profileErr) {
        setDebugError(profileErr.message);
        setDebugRole("(query error)");
        // Don't redirect — show debug panel so we can read the error
        setChecking(false);
        return;
      }

      const role = profile?.role ?? "(null — row not found)";
      setDebugRole(role);

      if (role !== "platform_admin") {
        // Don't redirect immediately — keep checking=true but show debug panel
        setChecking(false);
        return;
      }

      setChecking(false);
    })();
  }, []); // stable — no deps needed

  // ── DEBUG PANEL (always visible while checking or if role mismatch) ──
  const debugPanel = (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "#1e293b",
        color: "#e2e8f0",
        fontFamily: "monospace",
        fontSize: 12,
        padding: "8px 16px",
        borderTop: "2px solid #f59e0b",
        display: "flex",
        flexWrap: "wrap" as const,
        gap: "16px",
      }}
    >
      <span><strong style={{ color: "#f59e0b" }}>role=</strong>{debugRole}</span>
      <span><strong style={{ color: "#f59e0b" }}>userId=</strong>{debugUserId.slice(0, 8)}…</span>
      <span><strong style={{ color: "#f59e0b" }}>loading=</strong>{String(checking)}</span>
      <span><strong style={{ color: "#f59e0b" }}>pathname=</strong>{pathname}</span>
      <span><strong style={{ color: "#f59e0b" }}>profileLoaded=</strong>{String(debugProfileLoaded)}</span>
      {debugAuthError && <span style={{ color: "#f87171" }}><strong>authErr=</strong>{debugAuthError}</span>}
      {debugError && <span style={{ color: "#f87171" }}><strong>profileErr=</strong>{debugError}</span>}
      {debugRole !== "platform_admin" && debugProfileLoaded && !debugError && (
        <span style={{ color: "#fbbf24" }}>
          ⚠ role is &quot;{debugRole}&quot; — expected &quot;platform_admin&quot;. Run: UPDATE public.profiles SET role = &apos;platform_admin&apos; WHERE id = &apos;{debugUserId}&apos;;
        </span>
      )}
    </div>
  );

  if (checking) {
    return (
      <>
        <div className="flex h-screen items-center justify-center bg-gray-50">
          <div className="space-y-4 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent mx-auto" />
            <p className="text-sm text-gray-500">Checking admin access…</p>
          </div>
        </div>
        {debugPanel}
      </>
    );
  }

  // Role loaded but not platform_admin — show access denied with debug
  if (debugRole !== "platform_admin") {
    return (
      <>
        <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-50">
          <p className="text-lg font-semibold text-gray-700">Access denied</p>
          <p className="text-sm text-gray-500">
            Your role is <code className="rounded bg-gray-100 px-1">{debugRole}</code>. Only <code className="rounded bg-gray-100 px-1">platform_admin</code> can view this page.
          </p>
          <button
            onClick={() => router.replace("/feed")}
            className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
          >
            Go to feed
          </button>
        </div>
        {debugPanel}
      </>
    );
  }

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-gray-900 transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center gap-2 px-6 border-b border-gray-700">
          <span className="text-lg font-bold text-amber-400">TheBride</span>
          <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-xs font-semibold text-amber-300">
            {t("admin_platform")}
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? "bg-amber-500 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d={item.icon} />
              </svg>
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <div className="border-t border-gray-700 p-4">
          <Link
            href="/feed"
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {t("common_back")} TheBride
          </Link>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-gray-200 bg-white px-4 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
            aria-label="Open menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="font-bold text-gray-900">TheBride {t("admin_platform")}</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          {children}
        </main>
      </div>
      {debugPanel}
    </div>
  );
}
