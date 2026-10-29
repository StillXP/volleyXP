import type { TagTone } from "@lockin/react";

export const STATUS_TAG: Record<string, { label: string; tone: TagTone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  REGISTRATION: { label: "Registration", tone: "info" },
  IN_PROGRESS: { label: "In progress", tone: "brand" },
  COMPLETED: { label: "Completed", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
};

export const statusTag = (status: string) => STATUS_TAG[status] ?? { label: status, tone: "neutral" as const };
