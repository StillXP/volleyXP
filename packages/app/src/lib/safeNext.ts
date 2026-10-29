/**
 * Where to go after signing in: the page the person came from, if it is on this site.
 *
 * The destination travels in a query string, so anyone can put anything there. Following
 * it blindly would let a crafted link send someone to another site right after they
 * type their password. Only paths on this site are accepted; anything else falls back.
 */
export function safeNext(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  try {
    // Parsing strips tabs and newlines, so "/\t/evil.com" is really "//evil.com"; resolving
    // against a dummy origin and comparing catches that and anything like it.
    const base = "http://localhost";
    const url = new URL(value, base);
    if (url.origin !== base) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}

/** A link to a sign-in or sign-up page that returns to `next` afterwards. */
export const withNext = (path: string, next: string) => `${path}?next=${encodeURIComponent(next)}`;
