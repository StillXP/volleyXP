import { vi } from "vitest";

/** Finds the ownerId the ownership helpers filter on, wherever it is nested. */
export function ownerInWhere(where: unknown): string | undefined {
  if (!where || typeof where !== "object") return undefined;
  for (const [key, value] of Object.entries(where)) {
    if (key === "ownerId") return value as string;
    const nested = ownerInWhere(value);
    if (nested) return nested;
  }
  return undefined;
}

/**
 * A findFirst mock that only returns a row when the query is scoped to that row's
 * owner. `ownerOf` maps a row id to the owner of the tournament it belongs to.
 */
export function ownedFindFirst(ownerOf: Record<string, string>, extra: (id: string) => object = () => ({})) {
  return vi.fn(async ({ where }: { where: { id: string } }): Promise<Record<string, unknown> | null> =>
    ownerOf[where.id] && ownerOf[where.id] === ownerInWhere(where) ? { id: where.id, ...extra(where.id) } : null
  );
}
