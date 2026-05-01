import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { auth } from "@clerk/nextjs/server";
import { appRouter } from "../../../../server/root";
import { createContext } from "../../../../server/trpc";

const handler = async (req: Request) => {
  const { userId } = await auth();
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext(userId),
  });
};

export { handler as GET, handler as POST };
