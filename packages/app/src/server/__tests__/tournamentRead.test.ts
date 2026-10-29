import { describe, expect, it, vi } from "vitest";

// The real client opens a connection pool on import; the tests inject a fake instead.
vi.mock("../../lib/prisma", () => ({ prisma: {} }));

import { appRouter } from "../root";
import { createCallerFactory, type Context } from "../trpc";

function setup() {
  const prisma = { tournament: { findUniqueOrThrow: vi.fn(async (_args: unknown) => ({ id: "t1" })) } };
  const caller = createCallerFactory(appRouter)({ prisma, userId: null } as unknown as Context);
  return { prisma, caller };
}

type Select = Record<string, unknown>;
const selected = (prisma: ReturnType<typeof setup>["prisma"]) =>
  (prisma.tournament.findUniqueOrThrow.mock.calls[0]![0] as { where: unknown; select: Select }).select;

describe("tournament.getById", () => {
  it("is readable without signing in, and looks the tournament up by id", async () => {
    const { caller, prisma } = setup();
    await caller.tournament.getById({ id: "t1" });
    expect(prisma.tournament.findUniqueOrThrow).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "t1" } }));
  });

  it("selects only the owner's id and name, never an email", async () => {
    const { caller, prisma } = setup();
    await caller.tournament.getById({ id: "t1" });
    expect(selected(prisma).owner).toEqual({ select: { id: true, name: true } });
  });

  it("selects events oldest first, with team counts rather than the teams", async () => {
    const { caller, prisma } = setup();
    await caller.tournament.getById({ id: "t1" });
    const events = selected(prisma).events as { orderBy: unknown; select: Select };
    expect(events.orderBy).toEqual({ createdAt: "asc" });
    expect(events.select._count).toEqual({ select: { teams: true } });
    expect(events.select).not.toHaveProperty("teams");
  });

  it("uses select rather than include, so only the listed fields can be returned", async () => {
    const { caller, prisma } = setup();
    await caller.tournament.getById({ id: "t1" });
    const args = prisma.tournament.findUniqueOrThrow.mock.calls[0]![0] as Record<string, unknown>;
    expect(args).toHaveProperty("select");
    expect(args).not.toHaveProperty("include");
  });
});
