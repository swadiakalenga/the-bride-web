/**
 * Lightweight in-memory cache with per-entry TTL.
 * No external dependencies.  Safe for client components.
 *
 * Usage:
 *   setCache("profile:abc", data, 120_000); // 2-min TTL
 *   const data = getCache<Profile>("profile:abc");
 *   invalidateCache("profile:");            // clear all profile entries
 */

type Entry<T> = { value: T; expiresAt: number };

const store = new Map<string, Entry<unknown>>();

export function setCache<T>(key: string, value: T, ttlMs = 60_000): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function getCache<T>(key: string): T | null {
  const entry = store.get(key) as Entry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function invalidateCache(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function clearCache(): void {
  store.clear();
}

/**
 * Returns the cached value if fresh, otherwise calls loader(), caches the
 * result, and returns it.
 */
export async function withCache<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs = 60_000,
): Promise<T> {
  const cached = getCache<T>(key);
  if (cached !== null) return cached;
  const value = await loader();
  setCache(key, value, ttlMs);
  return value;
}
