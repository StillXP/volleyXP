// Runs Better Auth's real sign-up and update paths against a real Postgres, to check that
// firstName, lastName and name can't disagree. Opt-in, like integration.test.ts: set
// TEST_DATABASE_URL to a migrated database whose name ends in _test.
import { afterAll, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

vi.mock("../../lib/prisma", () => ({ prisma: {} }));

import { PrismaClient } from "../../generated/prisma/client";
import { createAuth, fullName } from "../../lib/auth";

const url = process.env.TEST_DATABASE_URL;
if (url && !/_test(\?|$)/.test(url)) {
  throw new Error("TEST_DATABASE_URL must point at a database whose name ends in _test");
}

describe("fullName", () => {
  it("joins the parts with one space and trims", () => {
    expect(fullName("Ada", "Lovelace")).toBe("Ada Lovelace");
    expect(fullName("Ada", "")).toBe("Ada");
  });
});

describe.skipIf(!url)("user names against a real database", () => {
  const pool = new Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const auth = createAuth(prisma, {
    secret: "a-test-only-secret-that-is-long-enough-0123456789",
    baseURL: "http://localhost:3000",
    plugins: [], // Next's cookie handling needs a Next request
  });
  const prefix = `names-${Date.now()}`;
  let count = 0;

  const signUp = (body: Record<string, unknown>) =>
    auth.api.signUpEmail({ body: { email: `${prefix}-${count++}@test.io`, password: "correct-horse-battery", ...body } as never });
  const userWithEmail = (email: string) => prisma.user.findUnique({ where: { email } });
  const usersMade = () => prisma.user.count({ where: { email: { startsWith: prefix } } });
  const update = async (id: string, data: Record<string, unknown>) => (await auth.$context).internalAdapter.updateUser(id, data);

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: prefix } } });
    await prisma.$disconnect();
  });

  it("stores the first and last name and derives the display name from them", async () => {
    const { user } = await signUp({ name: "ignored", firstName: "Ada", lastName: "Lovelace" });
    expect(await userWithEmail(user.email)).toMatchObject({ firstName: "Ada", lastName: "Lovelace", name: "Ada Lovelace" });
  });

  it("trims the names", async () => {
    const { user } = await signUp({ name: "x", firstName: "  Grace ", lastName: " Hopper  " });
    expect(await userWithEmail(user.email)).toMatchObject({ firstName: "Grace", lastName: "Hopper", name: "Grace Hopper" });
  });

  it("overrides a display name a client sends that doesn't match", async () => {
    const { user } = await signUp({ name: "Someone Else Entirely", firstName: "Katherine", lastName: "Johnson" });
    expect((await userWithEmail(user.email))!.name).toBe("Katherine Johnson");
  });

  it("keeps multi-word surnames whole", async () => {
    const { user } = await signUp({ name: "x", firstName: "Maria", lastName: "de la Cruz" });
    expect(await userWithEmail(user.email)).toMatchObject({ firstName: "Maria", lastName: "de la Cruz", name: "Maria de la Cruz" });
  });

  describe("refuses to create a user", () => {
    const longName = "x".repeat(101);
    it.each([
      ["a blank first name", { firstName: "", lastName: "Hopper" }],
      ["a blank last name", { firstName: "Grace", lastName: "" }],
      ["names that are only spaces", { firstName: "   ", lastName: "   " }],
      ["a missing last name", { firstName: "Grace" }],
      ["a missing first name", { lastName: "Hopper" }],
      ["a first name over 100 characters", { firstName: longName, lastName: "Hopper" }],
      ["a last name over 100 characters", { firstName: "Grace", lastName: longName }],
    ])("with %s", async (_label, names) => {
      const before = await usersMade();
      await expect(signUp({ name: "x", ...names })).rejects.toBeTruthy();
      expect(await usersMade()).toBe(before);
    });

    it("and says what is wrong when a name is blank", async () => {
      await expect(signUp({ name: "x", firstName: " ", lastName: "Hopper" })).rejects.toMatchObject({
        body: { message: "First and last name are required" },
      });
    });
  });

  describe("when a user is updated", () => {
    it("changes the display name along with the two parts", async () => {
      const { user } = await signUp({ name: "x", firstName: "Ada", lastName: "Lovelace" });
      await update(user.id, { firstName: " Augusta ", lastName: "King" });
      expect(await userWithEmail(user.email)).toMatchObject({ firstName: "Augusta", lastName: "King", name: "Augusta King" });
    });

    it.each([
      ["the display name alone", { name: "Hacked Name" }],
      ["only the first name", { firstName: "Augusta" }],
      ["only the last name", { lastName: "King" }],
      ["a blank last name", { firstName: "Augusta", lastName: " " }],
    ])("refuses to change %s", async (_label, data) => {
      const { user } = await signUp({ name: "x", firstName: "Ada", lastName: "Lovelace" });
      await expect(update(user.id, data)).rejects.toBeTruthy();
      expect(await userWithEmail(user.email)).toMatchObject({ firstName: "Ada", lastName: "Lovelace", name: "Ada Lovelace" });
    });

    it("leaves the names alone when something else changes", async () => {
      const { user } = await signUp({ name: "x", firstName: "Ada", lastName: "Lovelace" });
      await update(user.id, { image: "https://example.com/ada.png" });
      expect(await userWithEmail(user.email)).toMatchObject({ image: "https://example.com/ada.png", name: "Ada Lovelace" });
    });
  });
});
