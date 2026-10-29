import { useEffect } from "react";

/**
 * Gives the page its own title ("Summer Open · Volley") so tabs, history and screen
 * readers can tell routes apart. The pages are client components, so they can't export
 * Next's metadata. Restores the previous title when the page goes away.
 */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = `${title} · Volley`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
