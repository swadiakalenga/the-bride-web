import { supabase } from "../supabase";

/**
 * Returns true if the currently authenticated user has the platform_admin role.
 * Works client-side only (reads from the Supabase JS client session).
 * Returns false if the user is not authenticated or the profile cannot be fetched.
 */
export async function isPlatformAdmin(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return data?.role === "platform_admin";
}

/**
 * Returns "platform_admin" | other role string | null.
 * Cheaper than isPlatformAdmin when you need the full role value.
 */
export async function getCurrentRole(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return data?.role ?? null;
}
