import { describe, expect, it, vi } from "vitest";

// The real client opens a connection pool on import; the tests inject a fake instead.
vi.mock("../../lib/prisma", () => ({ prisma: {} }));

import { appRouter } from "../root";
import { createCallerFactory, type Context } from "../trpc";
import { ownedFindFirst } from "./helpers";

const OWNER = "user-owner";
const STRANGER = "user-stranger";

// Row id -> owner (of the venue, or of the tournament the row belongs to).
const ownerOf: Record<string, string> = { t1: OWNER, e1: OWNER, l1: OWNER, c1: OWNER };

function setup(userId: string | null) {
  const prisma = {
    tournament: {
      findFirst: ownedFindFirst(ownerOf),
      update: vi.fn(async (_args: unknown) => ({})),
      count: vi.fn(async () => 0),
    },
    event: { findFirst: ownedFindFirst(ownerOf) },
    location: {
      findFirst: ownedFindFirst(ownerOf),
      findMany: vi.fn(async (_args: unknown) => []),
      create: vi.fn(async (_args: unknown) => ({})),
      update: vi.fn(async (_args: unknown) => ({})),
      delete: vi.fn(async () => ({})),
    },
    court: {
      findFirst: ownedFindFirst(ownerOf),
      create: vi.fn(async (_args: unknown) => ({})),
      update: vi.fn(async (_args: unknown) => ({})),
      delete: vi.fn(async () => ({})),
    },
    match: { count: vi.fn(async () => 0) },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const caller = createCallerFactory(appRouter)({ prisma, userId } as unknown as Context);
  return { prisma, caller };
}

type Caller = ReturnType<typeof setup>["caller"];
type Prisma = ReturnType<typeof setup>["prisma"];

// Mutations on existing venues, courts and events, with the write each must guard.
const guarded: { name: string; call: (c: Caller) => Promise<unknown>; write: (p: Prisma) => unknown }[] = [
  { name: "tournament.setLocation", call: (c) => c.tournament.setLocation({ id: "t1", locationId: "l1" }), write: (p) => p.tournament.update },
  { name: "location.update", call: (c) => c.location.update({ id: "l1", name: "Riverside" }), write: (p) => p.location.update },
  { name: "location.delete", call: (c) => c.location.delete({ id: "l1" }), write: (p) => p.location.delete },
  { name: "court.createForLocation", call: (c) => c.court.createForLocation({ locationId: "l1", name: "Court 1" }), write: (p) => p.court.create },
  { name: "court.createForEvent", call: (c) => c.court.createForEvent({ eventId: "e1", name: "Net 1" }), write: (p) => p.court.create },
  { name: "court.bulkCreateForEvent", call: (c) => c.court.bulkCreateForEvent({ eventId: "e1", count: 3 }), write: (p) => p.court.create },
  { name: "court.update", call: (c) => c.court.update({ id: "c1", name: "Centre Court" }), write: (p) => p.court.update },
  { name: "court.delete", call: (c) => c.court.delete({ id: "c1" }), write: (p) => p.court.delete },
];

describe.each(guarded)("$name", ({ call, write }) => {
  it("rejects signed-out callers", async () => {
    const { caller, prisma } = setup(null);
    await expect(call(caller)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(write(prisma)).not.toHaveBeenCalled();
  });

  it("rejects callers who don't own it", async () => {
    const { caller, prisma } = setup(STRANGER);
    await expect(call(caller)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(write(prisma)).not.toHaveBeenCalled();
  });

  it("lets the owner through", async () => {
    const { caller, prisma } = setup(OWNER);
    await call(caller);
    expect(write(prisma)).toHaveBeenCalled();
  });
});

describe("location", () => {
  it("create and listMine reject signed-out callers", async () => {
    const { caller, prisma } = setup(null);
    await expect(caller.location.create({ name: "Riverside" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.location.listMine()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(prisma.location.create).not.toHaveBeenCalled();
  });

  it("create makes the caller the owner", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.location.create({ name: "Riverside Park" });
    expect(prisma.location.create).toHaveBeenCalledWith({ data: { name: "Riverside Park", ownerId: OWNER } });
  });

  it("listMine only asks for the caller's venues", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.location.listMine();
    expect(prisma.location.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: OWNER } }));
  });

  it("update can clear the address with null", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.location.update({ id: "l1", address: null });
    expect(prisma.location.update).toHaveBeenCalledWith({ where: { id: "l1" }, data: { address: null } });
  });

  it("won't delete a venue a tournament uses", async () => {
    const { caller, prisma } = setup(OWNER);
    prisma.tournament.count.mockResolvedValue(1);
    await expect(caller.location.delete({ id: "l1" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(prisma.location.delete).not.toHaveBeenCalled();
  });

  it("won't delete a venue whose courts have matches", async () => {
    const { caller, prisma } = setup(OWNER);
    prisma.match.count.mockResolvedValue(2);
    await expect(caller.location.delete({ id: "l1" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(prisma.match.count).toHaveBeenCalledWith({ where: { court: { locationId: "l1" } } });
    expect(prisma.location.delete).not.toHaveBeenCalled();
  });
});

describe("tournament.setLocation", () => {
  it("rejects a venue the caller doesn't own", async () => {
    const { caller, prisma } = setup(OWNER);
    await expect(caller.tournament.setLocation({ id: "t1", locationId: "l-elsewhere" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(prisma.tournament.update).not.toHaveBeenCalled();
  });

  it("clears the venue with null without looking one up", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.tournament.setLocation({ id: "t1", locationId: null });
    expect(prisma.location.findFirst).not.toHaveBeenCalled();
    expect(prisma.tournament.update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { locationId: null } });
  });
});

describe("court", () => {
  it("creates a fixed court on the venue and nothing else", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.court.createForLocation({ locationId: "l1", name: "Court 1", surface: "hardwood" });
    expect(prisma.court.create).toHaveBeenCalledWith({ data: { locationId: "l1", name: "Court 1", surface: "hardwood" } });
  });

  it("creates a temporary court on the event and allocates it there", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.court.createForEvent({ eventId: "e1", name: "Net 1", surface: "sand" });
    expect(prisma.court.create).toHaveBeenCalledWith({
      data: { name: "Net 1", surface: "sand", eventId: "e1", eventCourts: { create: { eventId: "e1" } } },
    });
  });

  it("bulk-creates numbered courts in one transaction", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.court.bulkCreateForEvent({ eventId: "e1", count: 3, prefix: "Beach Court" });
    const names = prisma.court.create.mock.calls.map(([arg]) => (arg as { data: { name: string } }).data.name);
    expect(names).toEqual(["Beach Court 1", "Beach Court 2", "Beach Court 3"]);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it("bulk-creates with the default prefix", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.court.bulkCreateForEvent({ eventId: "e1", count: 2 });
    const names = prisma.court.create.mock.calls.map(([arg]) => (arg as { data: { name: string } }).data.name);
    expect(names).toEqual(["Net 1", "Net 2"]);
  });

  it.each([0, 65, 1.5])("rejects a bulk count of %s", async (count) => {
    const { caller, prisma } = setup(OWNER);
    await expect(caller.court.bulkCreateForEvent({ eventId: "e1", count })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(prisma.court.create).not.toHaveBeenCalled();
  });

  it("is owned through either its venue or its event", async () => {
    const { caller, prisma } = setup(OWNER);
    await caller.court.update({ id: "c1", name: "Renamed" });
    expect(prisma.court.findFirst).toHaveBeenCalledWith({
      where: { id: "c1", OR: [{ location: { ownerId: OWNER } }, { event: { tournament: { ownerId: OWNER } } }] },
      select: { id: true },
    });
  });

  it("won't delete a court that has matches scheduled", async () => {
    const { caller, prisma } = setup(OWNER);
    prisma.match.count.mockResolvedValue(1);
    await expect(caller.court.delete({ id: "c1" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(prisma.court.delete).not.toHaveBeenCalled();
  });
});
