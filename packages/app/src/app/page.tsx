import type { Metadata } from "next";
import NextLink from "next/link";
import { Link } from "@lockin/react";
import { cssVars } from "@lockin/tokens";
import { HomeTournaments } from "../components/HomeTournaments";
import { Page, heading, muted, section } from "../components/PageShell";

export const metadata: Metadata = {
  title: "Volley · Run volleyball tournaments with live brackets",
  description: "Build a bracket, add your teams, and keep scores updating for everyone watching.",
};

export default function HomePage() {
  return (
    <Page>
      <h1 style={{ font: cssVars.typography.heading.xl, color: cssVars.color.text.primary }}>Volley</h1>
      <p style={{ ...muted, marginTop: cssVars.space.sm, maxWidth: "52ch" }}>
        Run volleyball tournaments with live brackets. Build a bracket, add your teams, and keep scores
        updating for everyone watching.
      </p>
      <div style={{ marginTop: cssVars.space.md }}>
        <Link as={NextLink} href="/create" variant="standalone">Try the bracket generator</Link>
      </div>

      <section style={section} aria-labelledby="tournaments-heading">
        <h2 id="tournaments-heading" style={heading}>Tournaments</h2>
        <HomeTournaments />
      </section>
    </Page>
  );
}
