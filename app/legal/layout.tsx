"use client";

import { useRouter } from "next/navigation";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
            aria-label="Back"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-amber-600">TheBride</span>
          <span className="text-sm text-gray-400">·</span>
          <span className="text-sm text-gray-500">Legal</span>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8 pb-20">
        {children}
      </div>
    </div>
  );
}
