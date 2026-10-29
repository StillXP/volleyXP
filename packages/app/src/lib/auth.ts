import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import type { PrismaClient } from "../generated/prisma/client";
import { prisma } from "./prisma";

const MAX_NAME_LENGTH = 100;

/** The display name Better Auth requires on every user: "First Last". */
export const fullName = (firstName: string, lastName: string) => `${firstName} ${lastName}`.trim();

const badRequest = (message: string) => new APIError("BAD_REQUEST", { message });

/** Trims the two names, insists on both, and derives `name` from them. */
function cleanNames(data: Record<string, unknown>) {
  const firstName = String(data.firstName ?? "").trim();
  const lastName = String(data.lastName ?? "").trim();
  if (!firstName || !lastName) throw badRequest("First and last name are required");
  if (firstName.length > MAX_NAME_LENGTH || lastName.length > MAX_NAME_LENGTH) {
    throw badRequest(`Names can be at most ${MAX_NAME_LENGTH} characters`);
  }
  return { firstName, lastName, name: fullName(firstName, lastName) };
}

interface Options {
  secret?: string;
  baseURL?: string;
  /** Defaults to Next's cookie handling, which needs a Next request; tests pass none. */
  plugins?: BetterAuthPlugin[];
}

/**
 * Users have a first and a last name. Better Auth still insists on `name`, so the hooks
 * below set it from the two and refuse any attempt to change one without the other,
 * which keeps all three consistent whatever a client sends.
 */
export function createAuth(db: PrismaClient, { plugins = [nextCookies()], ...options }: Options = {}) {
  return betterAuth({
    ...options,
    database: prismaAdapter(db, { provider: "postgresql" }),
    emailAndPassword: { enabled: true },
    user: {
      additionalFields: {
        firstName: { type: "string", required: true, input: true },
        lastName: { type: "string", required: true, input: true },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({ data: { ...user, ...cleanNames(user) } }),
        },
        update: {
          before: async (data) => {
            const touchesNames = data.firstName !== undefined || data.lastName !== undefined;
            if (!touchesNames && data.name === undefined) return { data };
            // `name` alone, or only one of the parts, would leave the three disagreeing.
            if (data.firstName === undefined || data.lastName === undefined) {
              throw badRequest("Change firstName and lastName together; name follows them");
            }
            return { data: { ...data, ...cleanNames(data) } };
          },
        },
      },
    },
    // Keep last so server actions can set the session cookie.
    plugins,
  });
}

export const auth = createAuth(prisma);
