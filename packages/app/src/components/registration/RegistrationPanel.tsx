"use client";

import NextLink from "next/link";
import { Link } from "@lockin/react";
import { cssVars } from "@lockin/tokens";
import { trpc } from "../../lib/trpc";
import { registrationPollInterval } from "../../lib/pollInterval";
import { withNext } from "../../lib/safeNext";
import { muted } from "../PageShell";
import { MyTeamPanel } from "./MyTeamPanel";
import { RegisterTeamForm } from "./RegisterTeamForm";

interface Props {
  eventId: string;
  event: { status: string; teamSize: number };
  signedIn: boolean;
  /** Called after any change, so the caller can refetch. */
  onChanged: () => Promise<unknown> | void;
}

/** What a visitor can do about registering: sign in, start a team, or look after theirs. */
export function RegistrationPanel({ eventId, event, signedIn, onChanged }: Props) {
  // Refreshed while registration is open, so a captain sees teammates arrive.
  const mine = trpc.registration.mine.useQuery(
    { eventId },
    { enabled: signedIn, refetchInterval: registrationPollInterval(event.status) }
  );
  const open = event.status === "REGISTRATION";
  const here = `/event/${eventId}`;

  let body: React.ReactNode;
  if (signedIn && mine.isLoading) {
    body = <p role="status" style={muted}>Checking your registration…</p>;
  } else if (mine.data) {
    body = <MyTeamPanel mine={mine.data} teamSize={event.teamSize} eventStatus={event.status} onChanged={onChanged} />;
  } else if (!open) {
    body = <p style={muted}>{event.status === "DRAFT" ? "Registration hasn't opened yet." : "Registration is closed."}</p>;
  } else if (!signedIn) {
    body = (
      <p style={muted}>
        <Link as={NextLink} href={withNext("/sign-in", here)}>Sign in</Link> or{" "}
        <Link as={NextLink} href={withNext("/sign-up", here)}>create an account</Link> to register a team.
      </p>
    );
  } else {
    body = <RegisterTeamForm eventId={eventId} onChanged={onChanged} />;
  }

  return (
    <section aria-labelledby="registration-heading" style={{ display: "flex", flexDirection: "column", gap: cssVars.space.sm }}>
      <h3 id="registration-heading" style={{ font: cssVars.typography.label.lg, color: cssVars.color.text.primary }}>
        {mine.data ? "Your team" : "Register a team"}
      </h3>
      {body}
    </section>
  );
}
