"use client";

import { useRef, useState } from "react";
import NextLink from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button, InputField, Link, RadioGroup, Tag } from "@lockin/react";
import type { RadioOption } from "@lockin/react";
import { cssVars } from "@lockin/tokens";
import { trpc } from "../../../lib/trpc";
import { authClient } from "../../../lib/auth-client";
import { statusTag } from "../../../lib/tournamentStatus";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { Page, section, heading, muted, errorText } from "../../../components/PageShell";

const TEAM_SIZE_OPTIONS: RadioOption[] = [
  { value: "2", label: "Doubles", description: "2 players per team." },
  { value: "4", label: "Quads", description: "4 players per team." },
  { value: "6", label: "Sixes", description: "6 players per team." },
];

const BEST_OF_OPTIONS: RadioOption[] = [
  { value: "1", label: "Single game" },
  { value: "3", label: "Best of 3" },
  { value: "5", label: "Best of 5" },
];

export default function TournamentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { data: tournament, isLoading } = trpc.tournament.getById.useQuery({ id });
  const isOwner = !!session && !!tournament && session.user.id === tournament.owner.id;
  useDocumentTitle(tournament?.name ?? (isLoading ? "Loading tournament" : "Tournament not found"));

  const [name, setName] = useState("");
  const [teamSize, setTeamSize] = useState("2");
  const [bestOf, setBestOf] = useState("3");
  const [entryCap, setEntryCap] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const createEvent = trpc.event.create.useMutation({
    onSuccess: (event) => router.push(`/event/${event.id}`),
  });

  // Validated on submit rather than every keystroke; the button stays enabled so the
  // error says what to fix (Lock In form guidance).
  const nameError = name.trim() ? undefined : "Enter a name for the event";
  const capNumber = Number(entryCap);
  const capError = entryCap.trim() === "" || (Number.isInteger(capNumber) && capNumber >= 1) ? undefined : "Enter a whole number, 1 or more";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameError || capError) {
      setShowErrors(true);
      if (nameError) nameRef.current?.focus();
      return;
    }
    createEvent.mutate({
      tournamentId: id,
      name: name.trim(),
      teamSize: Number(teamSize),
      bestOf: Number(bestOf),
      ...(entryCap.trim() !== "" && { entryCap: capNumber }),
    });
  };

  if (isLoading) {
    return <Page><p style={muted}>Loading tournament…</p></Page>;
  }
  if (!tournament) {
    return <Page><h1 style={heading}>Tournament not found</h1><p style={muted}>It may have been deleted, or the link is wrong.</p></Page>;
  }

  const status = statusTag(tournament.status);

  return (
    <Page>
      <p style={{ font: cssVars.typography.body.sm, color: cssVars.color.text.secondary }}>
        {isOwner ? <Link as={NextLink} href="/dashboard">Dashboard</Link> : <>Hosted by {tournament.owner.name}</>}
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: cssVars.space.sm, flexWrap: "wrap", marginTop: cssVars.space.xs }}>
        <h1 style={{ font: cssVars.typography.heading.lg, color: cssVars.color.text.primary }}>{tournament.name}</h1>
        <Tag tone={status.tone} size="sm">{status.label}</Tag>
      </div>
      {tournament.description ? <p style={{ ...muted, marginTop: cssVars.space.sm }}>{tournament.description}</p> : null}
      {tournament.location ? (
        <p style={{ ...muted, marginTop: cssVars.space.xs }}>
          {tournament.location.name}
          {tournament.location.address ? ` · ${tournament.location.address}` : ""}
        </p>
      ) : null}

      <section style={section} aria-labelledby="events-heading">
        <h2 id="events-heading" style={heading}>Events</h2>
        {tournament.events.length === 0 ? (
          <p style={muted}>{isOwner ? "No events yet. Add the first one below." : "No events have been added yet."}</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {tournament.events.map((event) => (
              <li
                key={event.id}
                style={{ display: "flex", alignItems: "baseline", gap: cssVars.space.sm, flexWrap: "wrap", padding: `${cssVars.space.sm} 0`, borderBottom: `${cssVars.border.width.thin} solid ${cssVars.color.border.subtle}` }}
              >
                <strong style={{ font: cssVars.typography.label.lg }}>
                  <Link as={NextLink} href={`/event/${event.id}`}>{event.name}</Link>
                </strong>
                <span style={{ font: cssVars.typography.body.sm, color: cssVars.color.text.tertiary }}>
                  {event.bestOf === 1 ? "Single game" : `Best of ${event.bestOf}`} · {event.teamSize} per team · {event._count.teams}
                  {event.entryCap ? ` of ${event.entryCap}` : ""} team{event._count.teams === 1 && !event.entryCap ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isOwner ? (
        <section style={section} aria-labelledby="new-event-heading">
          <h2 id="new-event-heading" style={heading}>Add an event</h2>
          <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: cssVars.space.lg }}>
            <InputField
              ref={nameRef}
              label="Event name"
              hint="For example, Mixed Doubles or Open Division."
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name && setShowErrors(true)}
              error={showErrors ? nameError : undefined}
            />
            <RadioGroup legend="Team size" options={TEAM_SIZE_OPTIONS} value={teamSize} onValueChange={setTeamSize} />
            <RadioGroup legend="Match format" options={BEST_OF_OPTIONS} value={bestOf} onValueChange={setBestOf} />
            <InputField
              label="Team limit (optional)"
              hint="Leave blank for no limit."
              type="number"
              inputMode="numeric"
              min={1}
              value={entryCap}
              onChange={(e) => setEntryCap(e.target.value)}
              error={showErrors ? capError : undefined}
            />
            {createEvent.error ? <p role="alert" style={errorText}>{createEvent.error.message}</p> : null}
            <div>
              <Button type="submit" loading={createEvent.isPending} loadingLabel="Creating event">Create event</Button>
            </div>
          </form>
        </section>
      ) : null}
    </Page>
  );
}
