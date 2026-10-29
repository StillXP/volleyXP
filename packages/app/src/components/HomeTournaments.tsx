"use client";

import NextLink from "next/link";
import { Link, Tag } from "@lockin/react";
import { cssVars } from "@lockin/tokens";
import { trpc } from "../lib/trpc";
import { statusTag } from "../lib/tournamentStatus";
import { muted } from "./PageShell";

const formatDate = (date: string | Date) =>
  new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

/** The tournaments anyone can see: opened up, so no drafts or cancelled ones. */
export function HomeTournaments() {
  const { data: tournaments, isLoading, error } = trpc.tournament.listPublic.useQuery();

  if (isLoading) return <p role="status" style={muted}>Loading tournaments…</p>;
  if (error || !tournaments) {
    return <p role="alert" style={muted}>Tournaments couldn&apos;t be loaded. Try again in a moment.</p>;
  }
  if (tournaments.length === 0) {
    return (
      <p style={muted}>
        No tournaments are open yet. <Link as={NextLink} href="/sign-up">Create an account</Link> to run the first one.
      </p>
    );
  }

  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {tournaments.map((t) => {
        const status = statusTag(t.status);
        const details = [
          `${t._count.events} event${t._count.events === 1 ? "" : "s"}`,
          t.location?.name,
          t.startDate ? formatDate(t.startDate) : undefined,
          `Hosted by ${t.owner.name}`,
        ].filter(Boolean);
        return (
          <li
            key={t.id}
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "baseline",
              gap: cssVars.space.xs,
              padding: `${cssVars.space.sm} 0`,
              borderBottom: `${cssVars.border.width.thin} solid ${cssVars.color.border.subtle}`,
            }}
          >
            <strong style={{ font: cssVars.typography.label.lg }}>
              <Link as={NextLink} href={`/tournament/${t.id}`}>{t.name}</Link>
            </strong>
            <Tag tone={status.tone} size="sm">{status.label}</Tag>
            <span style={{ flexBasis: "100%", font: cssVars.typography.body.sm, color: cssVars.color.text.secondary }}>
              {details.join(" · ")}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
