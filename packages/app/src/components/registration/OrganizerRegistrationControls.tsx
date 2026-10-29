"use client";

import { Button } from "@lockin/react";
import { cssVars } from "@lockin/tokens";
import { trpc } from "../../lib/trpc";
import { errorText, muted } from "../PageShell";

interface Props {
  eventId: string;
  status: string;
  /** Called after the change, so the caller can refetch. */
  onChanged: () => Promise<unknown> | void;
}

const COPY: Record<string, { note: string; action: string; open: boolean }> = {
  DRAFT: { note: "Registration hasn't opened. Open it and teams can sign up with an invite link.", action: "Open registration", open: true },
  REGISTRATION: { note: "Registration is open.", action: "Close registration", open: false },
  SEEDING: { note: "Registration is closed.", action: "Reopen registration", open: true },
};

/** The organizer's switch for letting teams sign themselves up. */
export function OrganizerRegistrationControls({ eventId, status, onChanged }: Props) {
  const set = trpc.event.setRegistration.useMutation({ onSuccess: async () => { await onChanged(); } });
  const copy = COPY[status];
  if (!copy) return null; // the bracket exists, so registration is settled

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: cssVars.space.xs }}>
      <div style={{ display: "flex", alignItems: "center", gap: cssVars.space.sm, flexWrap: "wrap" }}>
        <span style={muted}>{copy.note}</span>
        <Button
          variant="secondary"
          size="sm"
          loading={set.isPending}
          loadingLabel="Changing registration"
          onClick={() => set.mutate({ id: eventId, open: copy.open })}
        >
          {copy.action}
        </Button>
      </div>
      {set.error ? <p role="alert" style={errorText}>{set.error.message}</p> : null}
    </div>
  );
}
