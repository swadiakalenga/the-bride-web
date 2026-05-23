"use client";

// This route previously hosted a standalone schedule form.
// All live creation/scheduling now happens in /church/[id]/live/manage.
// We redirect there if a church param is present, otherwise fall back to /live.

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LiveCreateRedirectPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
      </div>
    }>
      <LiveCreateRedirect />
    </Suspense>
  );
}

function LiveCreateRedirect() {
  const router = useRouter();
  const params = useSearchParams();
  const churchId = params.get("church");

  useEffect(() => {
    if (churchId) {
      router.replace(`/church/${churchId}/live/manage`);
    } else {
      router.replace("/live");
    }
  }, [churchId, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
    </div>
  );
}
