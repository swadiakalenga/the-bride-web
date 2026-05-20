"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    };

    getUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-6 text-center">
      <h1 className="text-3xl font-bold">Welcome to The Bride</h1>

      {user && (
        <p className="mt-4 text-gray-700">
          Logged in as: <strong>{user.email}</strong>
        </p>
      )}

      <div className="mt-6 flex gap-4">
  <button
    onClick={() => (window.location.href = "/profile")}
    className="px-6 py-3 bg-brand-600 text-white rounded-lg"
  >
    My Profile
  </button>

  <button
    onClick={() => (window.location.href = "/feed")}
    className="px-6 py-3 bg-green-600 text-white rounded-lg"
  >
    Feed
  </button>

  <button
    onClick={handleLogout}
    className="px-6 py-3 bg-red-600 text-white rounded-lg"
  >
    Logout
  </button>
</div>
    </main>
  );
}