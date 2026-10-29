import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { assertCourtOwner, assertEventOwner, assertLocationOwner } from "../ownership";

const name = z.string().min(1);
// "hardwood", "sand", "grass"
const surface = z.string().min(1).optional();

// A temporary court belongs to one event, so it is allocated to that event as it's created.
const eventCourt = (eventId: string, data: { name: string; surface?: string | undefined }) => ({
  ...data,
  eventId,
  eventCourts: { create: { eventId } },
});

export const courtRouter = router({
  // A fixed court at a venue. Attach it to events with event.setCourts.
  createForLocation: protectedProcedure
    .input(z.object({ locationId: z.string(), name, surface }))
    .mutation(async ({ ctx, input }) => {
      await assertLocationOwner(ctx.prisma, ctx.userId, input.locationId);
      return ctx.prisma.court.create({ data: input });
    }),

  // A temporary court (a net at a park or beach) that exists only for this event.
  createForEvent: protectedProcedure
    .input(z.object({ eventId: z.string(), name, surface }))
    .mutation(async ({ ctx, input }) => {
      await assertEventOwner(ctx.prisma, ctx.userId, input.eventId);
      const { eventId, ...data } = input;
      return ctx.prisma.court.create({ data: eventCourt(eventId, data) });
    }),

  // Creates "Net 1", "Net 2", ... for an event in one go.
  bulkCreateForEvent: protectedProcedure
    .input(z.object({ eventId: z.string(), count: z.number().int().min(1).max(64), prefix: name.default("Net"), surface }))
    .mutation(async ({ ctx, input }) => {
      await assertEventOwner(ctx.prisma, ctx.userId, input.eventId);
      return ctx.prisma.$transaction(
        Array.from({ length: input.count }, (_, i) =>
          ctx.prisma.court.create({ data: eventCourt(input.eventId, { name: `${input.prefix} ${i + 1}`, surface: input.surface }) })
        )
      );
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), name: name.optional(), surface: z.string().min(1).nullable().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await assertCourtOwner(ctx.prisma, ctx.userId, id);
      return ctx.prisma.court.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertCourtOwner(ctx.prisma, ctx.userId, input.id);
      // Deleting would leave scheduled matches without a court.
      const matches = await ctx.prisma.match.count({ where: { courtId: input.id } });
      if (matches > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "Matches are scheduled on this court" });
      }
      return ctx.prisma.court.delete({ where: { id: input.id } });
    }),
});
