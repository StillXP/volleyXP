"use client";

import { useMemo, useState } from "react";
import NextLink from "next/link";
import { useParams } from "next/navigation";
import { Button, InputField, Link, RadioGroup, Tag } from "@lockin/react";
import type { RadioOption } from "@lockin/react";
import { cssVars } from "@lockin/tokens";
import { Bracket } from "@volley/bracket";
import { trpc } from "../../../lib/trpc";
import { authClient } from "../../../lib/auth-client";
import { toBracketView } from "../../../lib/bracketView";
import { matchPollInterval, registrationPollInterval } from "../../../lib/pollInterval";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { MatchScorer } from "../../../components/MatchScorer";
import { Page, section, heading, muted, errorText } from "../../../components/PageShell";
import { OrganizerRegistrationControls } from "../../../components/registration/OrganizerRegistrationControls";
import { RegistrationPanel } from "../../../components/registration/RegistrationPanel";
import { TeamsList } from "../../../components/registration/TeamsList";

const FORMAT_OPTIONS: RadioOption[] = [
  { value: "single", label: "Single Elimination", description: "One loss ends your run." },
  { value: "double", label: "Double Elimination", description: "A second chance through the losers bracket." },
];

export default function EventPage() {
  const { id } = useParams<{ id: string }>();
  const utils = trpc.useUtils();
  const { data: session } = authClient.useSession();

  const eventQuery = trpc.event.getById.useQuery({ id }, { refetchInterval: (query) => registrationPollInterval(query.state.data?.status) });
  const event = eventQuery.data;
  const bracketStage = event?.stages.find((s) => s.type === "SINGLE_ELIM" || s.type === "DOUBLE_ELIM");
  const isOwner = !!session && !!event && session.user.id === event.tournament.ownerId;
  useDocumentTitle(event ? `${event.name} · ${event.tournament.name}` : eventQuery.isLoading ? "Loading event" : "Event not found");

  // Teams refresh while registration is open, so the list fills in as teams sign up.
  const teamsQuery = trpc.team.getByEvent.useQuery({ eventId: id }, { refetchInterval: registrationPollInterval(event?.status) });
  // Scores change while people watch, so the bracket refreshes itself (see matchPollInterval).
  const matchesQuery = trpc.match.getByStage.useQuery(
    { stageId: bracketStage?.id ?? "" },
    { enabled: !!bracketStage, refetchInterval: (query) => matchPollInterval(query.state.data) }
  );
  const anyLive = !!matchesQuery.data?.some((m) => m.status === "IN_PROGRESS");
  const view = useMemo(() => toBracketView(matchesQuery.data ?? []), [matchesQuery.data]);
  // The bracket names matches by key; the scorer needs the stored match behind each one.
  const matchesByKey = useMemo(
    () => new Map((matchesQuery.data ?? []).flatMap((m) => (m.bracketKey ? [[m.bracketKey, m] as const] : []))),
    [matchesQuery.data]
  );

  const refresh = () =>
    Promise.all([
      utils.event.getById.invalidate({ id }),
      utils.team.getByEvent.invalidate({ eventId: id }),
      utils.registration.mine.invalidate({ eventId: id }),
      utils.match.getByStage.invalidate(),
    ]);
  const addTeam = trpc.team.create.useMutation({ onSuccess: refresh });
  const removeTeam = trpc.team.delete.useMutation({ onSuccess: refresh });
  const generate = trpc.event.generateBracket.useMutation({ onSuccess: refresh });
  const deleteBracket = trpc.stage.delete.useMutation({ onSuccess: () => { setConfirmingDelete(false); return refresh(); } });

  const [teamName, setTeamName] = useState("");
  const [format, setFormat] = useState<"single" | "double">("single");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (eventQuery.isLoading) {
    return <Page><p style={muted}>Loading event…</p></Page>;
  }
  if (!event) {
    return <Page><h1 style={heading}>Event not found</h1><p style={muted}>It may have been deleted, or the link is wrong.</p></Page>;
  }

  const teams = teamsQuery.data ?? [];
  const playing = teams.filter((t) => t.status === "REGISTERED" || t.status === "CHECKED_IN");
  // Teams that signed themselves up but haven't filled their roster yet. Teams added by hand
  // have no players recorded, so they don't count.
  const incomplete = playing.filter((t) => t.members.length > 0 && t.members.length < event.teamSize);
  const bracketFormat = bracketStage?.type === "DOUBLE_ELIM" ? "double" : "single";
  const rules = { bestOf: event.bestOf, pointsToWin: event.pointsToWin, pointsToWinLastGame: event.pointsToWinLastGame };
  // Only the organizer gets scoring controls; everyone else sees the read-only match view.
  const renderMatchActions = isOwner
    ? (key: string) => {
        const match = matchesByKey.get(key);
        return match ? <MatchScorer match={match} rules={rules} onChanged={refresh} /> : null;
      }
    : undefined;

  return (
    <Page wide={!!bracketStage}>
      <p style={{ font: cssVars.typography.body.sm, color: cssVars.color.text.secondary }}>
        {isOwner ? <Link as={NextLink} href="/dashboard">Dashboard</Link> : null}
        {isOwner ? " / " : null}
        <Link as={NextLink} href={`/tournament/${event.tournament.id}`}>{event.tournament.name}</Link>
      </p>
      <h1 style={{ font: cssVars.typography.heading.lg, color: cssVars.color.text.primary, marginTop: cssVars.space.xs }}>{event.name}</h1>
      <div style={{ display: "flex", gap: cssVars.space.xs, flexWrap: "wrap", marginTop: cssVars.space.sm }}>
        <Tag tone="neutral" size="sm">Best of {event.bestOf}</Tag>
        <Tag tone="neutral" size="sm">{event.teamSize} per team</Tag>
        <Tag tone="neutral" size="sm">{playing.length} team{playing.length === 1 ? "" : "s"}</Tag>
        {bracketStage ? <Tag tone="brand" size="sm">{bracketFormat === "double" ? "Double" : "Single"} elimination</Tag> : null}
        {!bracketStage && event.status === "REGISTRATION" ? <Tag tone="info" size="sm">Registration open</Tag> : null}
        {!bracketStage && event.status === "SEEDING" ? <Tag tone="neutral" size="sm">Registration closed</Tag> : null}
      </div>

      {bracketStage ? (
        <section style={section} aria-labelledby="bracket-heading">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: cssVars.space.md }}>
            <h2 id="bracket-heading" style={heading}>Bracket</h2>
            {isOwner && !confirmingDelete ? (
              <Button variant="secondary" size="sm" onClick={() => setConfirmingDelete(true)}>Delete bracket</Button>
            ) : null}
          </div>
          {isOwner && confirmingDelete ? (
            <div role="group" aria-label="Confirm deleting the bracket" style={{ display: "flex", alignItems: "center", gap: cssVars.space.sm, flexWrap: "wrap" }}>
              <span style={muted}>Delete the bracket and all its matches? You can generate a new one afterwards.</span>
              <Button size="sm" onClick={() => deleteBracket.mutate({ id: bracketStage.id })} loading={deleteBracket.isPending} loadingLabel="Deleting bracket">Delete</Button>
              <Button variant="secondary" size="sm" onClick={() => setConfirmingDelete(false)}>Cancel</Button>
            </div>
          ) : null}
          {deleteBracket.error ? <p role="alert" style={errorText}>{deleteBracket.error.message}</p> : null}
          {anyLive ? (
            <p style={{ ...muted, display: "flex", alignItems: "center", gap: cssVars.space.xs }}>
              <Tag tone="danger" size="sm">Live</Tag>
              Scores update automatically.
            </p>
          ) : null}
          {matchesQuery.isLoading ? (
            <p style={muted}>Loading bracket…</p>
          ) : (
            <div style={{ overflow: "auto", padding: cssVars.space.md, background: cssVars.color.background.subtle, borderRadius: cssVars.radius.lg }}>
              <Bracket
                teams={view.teams}
                eliminationFormat={bracketFormat}
                matchData={view.matchData}
                {...(renderMatchActions && { renderMatchActions })}
              />
            </div>
          )}
        </section>
      ) : (
        <>
          <section style={section} aria-labelledby="teams-heading">
            <h2 id="teams-heading" style={heading}>Teams</h2>
            {isOwner ? <OrganizerRegistrationControls eventId={id} status={event.status} onChanged={refresh} /> : null}
            <RegistrationPanel eventId={id} event={event} signedIn={!!session} onChanged={refresh} />
            {isOwner ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = teamName.trim();
                  if (name) addTeam.mutate({ eventId: id, name }, { onSuccess: () => setTeamName("") });
                }}
                style={{ display: "flex", alignItems: "flex-end", gap: cssVars.space.xs }}
              >
                <div style={{ flex: 1 }}>
                  <InputField label="Add a team by hand" hint="For walk-ups and teams that won't sign up themselves." value={teamName} onChange={(e) => setTeamName(e.target.value)} />
                </div>
                <Button type="submit" iconStart="plus" loading={addTeam.isPending} loadingLabel="Adding team">Add team</Button>
              </form>
            ) : null}
            {addTeam.error ? <p role="alert" style={errorText}>{addTeam.error.message}</p> : null}
            <TeamsList teams={teams} teamSize={event.teamSize} isOwner={isOwner} onRemove={(teamId) => removeTeam.mutate({ id: teamId })} />
            {removeTeam.error ? <p role="alert" style={errorText}>{removeTeam.error.message}</p> : null}
          </section>

          <section style={section} aria-labelledby="generate-heading">
            <h2 id="generate-heading" style={heading}>Bracket</h2>
            {isOwner ? (
              <>
                <p style={muted}>Teams are seeded in the order listed above. Generate the bracket when everyone is in.</p>
                <RadioGroup legend="Elimination format" hideLegend options={FORMAT_OPTIONS} value={format} onValueChange={(v) => setFormat(v as "single" | "double")} />
                {incomplete.length > 0 ? (
                  <p role="status" style={muted}>
                    {incomplete.length === 1 ? "1 team doesn't" : `${incomplete.length} teams don't`} have a full roster yet ({incomplete.map((t) => t.name).join(", ")}). You can still generate the bracket.
                  </p>
                ) : null}
                {generate.error ? <p role="alert" style={errorText}>{generate.error.message}</p> : null}
                <div>
                  <Button
                    onClick={() => generate.mutate({ eventId: id, format })}
                    disabled={playing.length < 2}
                    loading={generate.isPending}
                    loadingLabel="Generating bracket"
                  >
                    Generate bracket
                  </Button>
                  {playing.length < 2 ? <p style={{ ...muted, marginTop: cssVars.space.xs }}>Add at least two teams first.</p> : null}
                </div>
              </>
            ) : (
              <p style={muted}>The bracket hasn&apos;t been generated yet.</p>
            )}
          </section>
        </>
      )}
    </Page>
  );
}
