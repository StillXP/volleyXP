import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { appRouter } from "../../../../server/root";
import { createContext } from "../../../../server/trpc";

const handler = async (req: Request) => {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // read-only in Route Handlers — session refresh handled by middleware
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () =>
      createContext(
        user?.id ?? null,
        user?.email ?? null,
        (user?.user_metadata?.full_name as string | undefined) ?? null
      ),
  });
};

export { handler as GET, handler as POST };
