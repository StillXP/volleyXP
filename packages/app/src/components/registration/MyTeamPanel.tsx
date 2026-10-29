"use client";

import { useState } from "react";
import { Button, InputField, Tag } from "@lockin/react";
import { cssVars } from "@lockin/tokens";
import { trpc } from "../../lib/trpc";
import { needsMore, spotsLeft, teamStatusTag } from "../../lib/teamStatus";
import { errorText, muted } from "../PageShell";
import { ConfirmAction } from "./ConfirmAction";
import { InviteLink } from "./InviteLink";

export interface MyTeam {
  role: "CAPTAIN" | "PLAYER";
  inviteCode: string | null;
  team: {
    id: string;
    name: string;
    status: string;
    usesDefaultName: boolean;
    members: { role: "CAPTAIN" | "PLAYER"; user: { id: string; name: string } }[];
  };
}

interface Props {
  mine: MyTeam;
  teamSize: number;
  eventStatus: string;
  /** Called after any change, so the caller can refetch. */
  onChanged: () => Promise<unknown> | void;
}

/** The signed-in person's own team: roster, invite link, and what they can do about it. */
export function MyTeamPanel({ mine, teamSize, eventStatus, onChanged }: Props) {
  const { team, role, inviteCode } = mine;
  const captain = role === "CAPTAIN";
  const open = eventStatus === "REGISTRATION";
  const beforeBracket = open || eventStatus === "SEEDING";
  const missing = spotsLeft(teamSize, team.members.length);
  const status = teamStatusTag(team.status);

  const done = async () => { await onChanged(); };
  const rename = trpc.registration.rename.useMutation({ onSuccess: done });
  const withdraw = trpc.registration.withdraw.useMutation({ onSuccess: done });
  const leave = trpc.registration.leave.useMutation({ onSuccess: done });
  const rotate = trpc.registration.rotateInvite.useMutation({ onSuccess: done });
  const error = rename.error ?? withdraw.error ?? leave.error ?? rotate.error;

  // A generated name shows as a placeholder, so saving a blank box keeps it generated.
  const [name, setName] = useState(team.usesDefaultName ? "" : team.name);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: cssVars.space.md }}>
      <div style={{ display: "flex", alignItems: "center", gap: cssVars.space.sm, flexWrap: "wrap" }}>
        <strong style={{ font: cssVars.typography.label.lg, color: cssVars.color.text.primary }}>{team.name}</strong>
        <Tag tone={status.tone} size="sm">{status.label}</Tag>
      </div>

      {team.status === "WAITLISTED" ? (
        <p style={muted}>The event is full, so your team is on the waitlist. It moves up if a place opens.</p>
      ) : null}

      <ul aria-label="Players" style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: cssVars.space["2xs"] }}>
        {team.members.map((m) => (
          <li key={m.user.id} style={{ display: "flex", alignItems: "center", gap: cssVars.space.xs, font: cssVars.typography.body.md, color: cssVars.color.text.primary }}>
            {m.user.name}
            {m.role === "CAPTAIN" ? <Tag tone="neutral" size="sm">Captain</Tag> : null}
          </li>
        ))}
      </ul>
      <p style={muted}>{missing > 0 ? `${needsMore(missing)}.` : "Your team is full."}</p>

      {captain && open && missing > 0 && inviteCode ? (
        <InviteLink code={inviteCode} rotating={rotate.isPending} onRotate={() => rotate.mutate({ teamId: team.id })} />
      ) : null}

      {captain && beforeBracket && team.status !== "WITHDRAWN" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = name.trim();
            if (trimmed) rename.mutate({ teamId: team.id, name: trimmed });
          }}
          style={{ display: "flex", flexDirection: "column", gap: cssVars.space.xs }}
        >
          <InputField
            label="Team name"
            hint={team.usesDefaultName ? "Named after your last names for now. Type a name to change it." : undefined}
            placeholder={team.usesDefaultName ? team.name : undefined}
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div style={{ display: "flex", gap: cssVars.space.xs, flexWrap: "wrap" }}>
            <Button type="submit" variant="secondary" size="sm" loading={rename.isPending} loadingLabel="Saving name" disabled={!name.trim()}>
              Save name
            </Button>
            {!team.usesDefaultName ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => rename.mutate({ teamId: team.id }, { onSuccess: () => setName("") })}
              >
                Use the generated name
              </Button>
            ) : null}
          </div>
        </form>
      ) : null}

      {captain && beforeBracket && team.status !== "WITHDRAWN" ? (
        <ConfirmAction
          label="Withdraw team"
          prompt="Withdraw this team? Everyone on it can register again."
          confirmLabel="Withdraw"
          pending={withdraw.isPending}
          pendingLabel="Withdrawing team"
          onConfirm={() => withdraw.mutate({ teamId: team.id })}
        />
      ) : null}
      {!captain && open ? (
        <ConfirmAction
          label="Leave team"
          prompt="Leave this team? You can join another or register your own."
          confirmLabel="Leave"
          pending={leave.isPending}
          pendingLabel="Leaving team"
          onConfirm={() => leave.mutate({ teamId: team.id })}
        />
      ) : null}

      {error ? <p role="alert" style={errorText}>{error.message}</p> : null}
    </div>
  );
}
