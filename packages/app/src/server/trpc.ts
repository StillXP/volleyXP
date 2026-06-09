import { initTRPC, TRPCError } from "@trpc/server";
import { prisma } from "../lib/prisma";

export type Context = {
  prisma: typeof prisma;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
};

export const createContext = (
  userId: string | null,
  userEmail: string | null,
  userName: string | null
): Context => ({ prisma, userId, userEmail, userName });

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  await ctx.prisma.user.upsert({
    where: { clerkId: ctx.userId },
    update: {},
    create: {
      clerkId: ctx.userId,
      email: ctx.userEmail ?? "",
      name: ctx.userName ?? null,
    },
  });

  return next({ ctx: { ...ctx, userId: ctx.userId } });
});
