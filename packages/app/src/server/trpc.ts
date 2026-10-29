import { initTRPC, TRPCError } from "@trpc/server";
import { prisma } from "../lib/prisma";

export type Context = {
  prisma: typeof prisma;
  userId: string | null;
};

export const createContext = (userId: string | null): Context => ({ prisma, userId });

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});
