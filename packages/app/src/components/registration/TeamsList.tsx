"use client";

import { Button, Tag } from "@lockin/react";
import { cssVars } from "@lockin/tokens";
import { needsMore, spotsLeft } from "../../lib/teamStatus";
import { muted } from "../PageShell";

export interface TeamRow {
  id: string;
  name: string;
  status: string;
  members: { role: string; user: { id: string; name: string } }[];
}

interface Props {
  teams: TeamRow[];
  teamSize: number;
  isOwner: boolean;
  onRemove: (teamId: string) => void;
}

/** Every team in the event, with who is on it and whether the roster still has room. */
export function TeamsList({ teams, teamSize, isOwner, onRemove }: Props) {
  if (teams.length === 0) {
    return <p style={muted}>{isOwner ? "No teams yet. Teams can register themselves, or you can add them." : "No teams have signed up yet."}</p>;
  }
  return (
    <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {teams.map((t, i) => {
        // Teams an organizer added by hand have no players recorded, so there's nothing to chase.
        const missing = t.members.length > 0 && t.status !== "WITHDRAWN" ? spotsLeft(teamSize, t.members.length) : 0;
        return (
          <li
            key={t.id}
            style={{ display: "flex", alignItems: "center", gap: cssVars.space.sm, padding: `${cssVars.space.xs} 0`, borderBottom: `${cssVars.border.width.thin} solid ${cssVars.color.border.subtle}` }}
          >
            <span style={{ width: "2ch", font: cssVars.typography.body.sm, color: cssVars.color.text.tertiary }}>{i + 1}</span>
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <span style={{ font: cssVars.typography.label.lg, color: cssVars.color.text.primary }}>{t.name}</span>
              {t.members.length > 0 ? (
                <span style={{ font: cssVars.typography.body.sm, color: cssVars.color.text.secondary }}>
                  {t.members.map((m) => m.user.name).join(", ")}
                </span>
              ) : null}
            </div>
            {t.status === "WITHDRAWN" || t.status === "WAITLISTED" ? (
              <Tag tone="warning" size="sm">{t.status === "WITHDRAWN" ? "Withdrawn" : "Waitlisted"}</Tag>
            ) : null}
            {missing > 0 ? <Tag tone="neutral" size="sm">{needsMore(missing)}</Tag> : null}
            {isOwner ? (
              <Button variant="secondary" size="sm" style={{ marginLeft: "auto" }} aria-label={`Remove ${t.name}`} onClick={() => onRemove(t.id)}>
                Remove
              </Button>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
