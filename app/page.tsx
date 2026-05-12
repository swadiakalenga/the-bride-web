import Link from "next/link";
import Logo from "./components/ui/Logo";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6 text-center">
      {/* Logo mark */}
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-400 to-blue-500 shadow-xl">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
        </svg>
      </div>

      <Logo size="lg" />

      <p className="mt-4 max-w-sm text-base text-gray-500">
        A global community for believers — connect, worship, and grow together in faith.
      </p>

      <div className="mt-8 flex flex-col gap-3 w-full max-w-xs">
        <Link
          href="/register"
          className="rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-6 py-3 font-semibold text-white shadow-sm hover:from-amber-500 hover:to-amber-600 transition"
        >
          Get Started
        </Link>

        <Link
          href="/login"
          className="rounded-xl border border-gray-200 bg-white px-6 py-3 font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition"
        >
          Sign In
        </Link>
      </div>

      <p className="mt-8 text-xs text-gray-400">
        By joining, you agree to our terms of service.
      </p>
    </main>
  );
}
