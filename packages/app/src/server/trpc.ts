import { initTRPC, TRPCError } from "@trpc/server";
import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "../lib/prisma";

export type Context = {
  prisma: typeof prisma;
  userId: string | null;
};

export const createContext = (userId: string | null): Context => ({
  prisma,
  userId,
});

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const clerk = await clerkClient();
  const clerkUser = await clerk.users.getUser(ctx.userId);

  await ctx.prisma.user.upsert({
    where: { clerkId: ctx.userId },
    update: {},
    create: {
      clerkId: ctx.userId,
      email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
      name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null,
    },
  });

  return next({ ctx: { ...ctx, userId: ctx.userId } });
});
