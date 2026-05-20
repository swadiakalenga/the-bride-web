import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#faf8f5] px-6 text-center">
      {/* Logo mark */}
      <div className="mb-2 flex items-center justify-center">
        <Image
          src="/post-logo.jpeg"
          alt="TheBride"
          width={100}
          height={100}
          priority
          className="rounded-3xl shadow-xl"
        />
      </div>

      <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-gray-900">
        The<span className="text-brand-600">Bride</span>
      </h1>

      <p className="mt-4 max-w-sm text-base text-gray-500">
        A global community for believers — connect, worship, and grow together in faith.
      </p>

      <div className="mt-8 flex flex-col gap-3 w-full max-w-xs">
        <Link
          href="/register"
          className="rounded-xl brand-gradient-bg px-6 py-3 font-semibold text-white shadow-md hover:opacity-90 transition"
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
