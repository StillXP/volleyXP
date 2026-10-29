import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { auth } from "../../../../lib/auth";
import { appRouter } from "../../../../server/root";
import { createContext } from "../../../../server/trpc";

const handler = async (req: Request) => {
  const session = await auth.api.getSession({ headers: req.headers });

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext(session?.user.id ?? null),
  });
};

export { handler as GET, handler as POST };
