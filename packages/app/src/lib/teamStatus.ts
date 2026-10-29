import type { TagTone } from "@lockin/react";

const TEAM_STATUS: Record<string, { label: string; tone: TagTone }> = {
  REGISTERED: { label: "Registered", tone: "success" },
  CHECKED_IN: { label: "Checked in", tone: "success" },
  WAITLISTED: { label: "Waitlisted", tone: "warning" },
  WITHDRAWN: { label: "Withdrawn", tone: "neutral" },
};

export const teamStatusTag = (status: string) => TEAM_STATUS[status] ?? { label: status, tone: "neutral" as const };

/** How many players a team still needs to fill its roster, or 0 if it is full. */
export const spotsLeft = (teamSize: number, playerCount: number) => Math.max(0, teamSize - playerCount);

export const needsMore = (count: number) => `Needs ${count} more player${count === 1 ? "" : "s"}`;
