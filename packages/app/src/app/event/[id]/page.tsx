"use client";

import { useMemo, useState } from "react";
import NextLink from "next/link";
import { useParams } from "next/navigation";
import { Button, InputField, Link, RadioGroup, Tag } from "@lockin/react";
import type { RadioOption } from "@lockin/react";
import { cssVars } from "@lockin/tokens";
import { Bracket } from "@design-system/components";
import { trpc } from "../../../lib/trpc";
import { authClient } from "../../../lib/auth-client";
import { toBracketView } from "../../../lib/bracketView";

const FORMAT_OPTIONS: RadioOption[] = [
  { value: "single", label: "Single Elimination", description: "One loss ends your run." },
  { value: "double", label: "Double Elimination", description: "A second chance through the losers bracket." },
];

const section: React.CSSProperties = { display: "flex", flexDirection: "column", gap: cssVars.space.md, marginTop: cssVars.space.xl };
const heading: React.CSSProperties = { font: cssVars.typography.heading.sm, color: cssVars.color.text.primary };
const muted: React.CSSProperties = { font: cssVars.typography.body.md, color: cssVars.color.text.secondary };
const errorText: React.CSSProperties = { font: cssVars.typography.body.sm, color: cssVars.color.text.danger };

export default function EventPage() {
  const { id } = useParams<{ id: string }>();
  const utils = trpc.useUtils();
  const { data: session } = authClient.useSession();

  const eventQuery = trpc.event.getById.useQuery({ id });
  const event = eventQuery.data;
  const bracketStage = event?.stages.find((s) => s.type === "SINGLE_ELIM" || s.type === "DOUBLE_ELIM");
  const isOwner = !!session && !!event && session.user.id === event.tournament.ownerId;

  const teamsQuery = trpc.team.getByEvent.useQuery({ eventId: id });
  const matchesQuery = trpc.match.getByStage.useQuery({ stageId: bracketStage?.id ?? "" }, { enabled: !!bracketStage });
  const view = useMemo(() => toBracketView(matchesQuery.data ?? []), [matchesQuery.data]);

  const refresh = () => Promise.all([utils.event.getById.invalidate({ id }), utils.team.getByEvent.invalidate({ eventId: id }), utils.match.getByStage.invalidate()]);
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
  const bracketFormat = bracketStage?.type === "DOUBLE_ELIM" ? "double" : "single";

  return (
    <Page wide={!!bracketStage}>
      <p style={{ font: cssVars.typography.body.sm, color: cssVars.color.text.secondary }}>
        {isOwner ? <Link as={NextLink} href="/dashboard">Dashboard</Link> : null}
        {isOwner ? " / " : null}
        {event.tournament.name}
      </p>
      <h1 style={{ font: cssVars.typography.heading.lg, color: cssVars.color.text.primary, marginTop: cssVars.space.xs }}>{event.name}</h1>
      <div style={{ display: "flex", gap: cssVars.space.xs, flexWrap: "wrap", marginTop: cssVars.space.sm }}>
        <Tag tone="neutral" size="sm">Best of {event.bestOf}</Tag>
        <Tag tone="neutral" size="sm">{event.teamSize} per team</Tag>
        <Tag tone="neutral" size="sm">{playing.length} team{playing.length === 1 ? "" : "s"}</Tag>
        {bracketStage ? <Tag tone="brand" size="sm">{bracketFormat === "double" ? "Double" : "Single"} elimination</Tag> : null}
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
          {matchesQuery.isLoading ? (
            <p style={muted}>Loading bracket…</p>
          ) : (
            <div style={{ overflow: "auto", padding: cssVars.space.md, background: cssVars.color.background.subtle, borderRadius: cssVars.radius.lg }}>
              <Bracket teams={view.teams} eliminationFormat={bracketFormat} matchData={view.matchData} />
            </div>
          )}
        </section>
      ) : (
        <>
          <section style={section} aria-labelledby="teams-heading">
            <h2 id="teams-heading" style={heading}>Teams</h2>
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
                  <InputField label="Team name" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
                </div>
                <Button type="submit" iconStart="plus" loading={addTeam.isPending} loadingLabel="Adding team">Add team</Button>
              </form>
            ) : null}
            {addTeam.error ? <p role="alert" style={errorText}>{addTeam.error.message}</p> : null}
            {teams.length === 0 ? (
              <p style={muted}>{isOwner ? "No teams yet. Add the teams that are playing." : "No teams have been added yet."}</p>
            ) : (
              <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {teams.map((t, i) => (
                  <li
                    key={t.id}
                    style={{ display: "flex", alignItems: "center", gap: cssVars.space.sm, padding: `${cssVars.space.xs} 0`, borderBottom: `${cssVars.border.width.thin} solid ${cssVars.color.border.subtle}` }}
                  >
                    <span style={{ width: "2ch", font: cssVars.typography.body.sm, color: cssVars.color.text.tertiary }}>{i + 1}</span>
                    <span style={{ font: cssVars.typography.label.lg, color: cssVars.color.text.primary }}>{t.name}</span>
                    {t.status === "WITHDRAWN" || t.status === "WAITLISTED" ? <Tag tone="warning" size="sm">{t.status === "WITHDRAWN" ? "Withdrawn" : "Waitlisted"}</Tag> : null}
                    {isOwner ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        style={{ marginLeft: "auto" }}
                        aria-label={`Remove ${t.name}`}
                        onClick={() => removeTeam.mutate({ id: t.id })}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
            {removeTeam.error ? <p role="alert" style={errorText}>{removeTeam.error.message}</p> : null}
          </section>

          <section style={section} aria-labelledby="generate-heading">
            <h2 id="generate-heading" style={heading}>Bracket</h2>
            {isOwner ? (
              <>
                <p style={muted}>Teams are seeded in the order listed above. Generate the bracket when everyone is in.</p>
                <RadioGroup legend="Elimination format" hideLegend options={FORMAT_OPTIONS} value={format} onValueChange={(v) => setFormat(v as "single" | "double")} />
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

function Page({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main style={{ maxWidth: wide ? 1400 : 640, margin: `${cssVars.space.xl} auto`, padding: `0 ${cssVars.space.md}` }}>
      {children}
    </main>
  );
}
