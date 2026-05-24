"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../supabase";

/**
 * React hook. Call at the top of any user-facing page.
 * If the current user is a platform_admin, immediately redirects to /admin.
 *
 * Usage:
 *   export default function MyPage() {
 *     useRedirectIfPlatformAdmin();
 *     // ... rest of page
 *   }
 */
export function useRedirectIfPlatformAdmin(): void {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!cancelled && data?.role === "platform_admin") {
        router.replace("/admin");
      }
    })();

    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
