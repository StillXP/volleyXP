"use client";

import { useEffect, useState } from "react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { Button, InputField, Link, Tag, Toggle, getResolvedColorMode, setColorMode } from "@lockin/react";
import { cssVars } from "@lockin/tokens";
import { trpc } from "../../lib/trpc";
import { authClient } from "../../lib/auth-client";
import { statusTag } from "../../lib/tournamentStatus";

export default function DashboardPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const { data: tournaments, refetch } = trpc.tournament.getMine.useQuery();
  const createTournament = trpc.tournament.create.useMutation({
    onSuccess: () => { setName(""); refetch(); },
  });
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(getResolvedColorMode() === "dark"); }, []);

  const handleColorMode = (on: boolean) => {
    setColorMode(on ? "dark" : "light");
    setDark(on);
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div style={{ maxWidth: 600, margin: `${cssVars.space.xl} auto`, padding: `0 ${cssVars.space.md}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: cssVars.space.md }}>
        <h1 style={{ font: cssVars.typography.heading.lg, color: cssVars.color.text.primary }}>Tournaments</h1>
        <div style={{ display: "flex", alignItems: "center", gap: cssVars.space.md }}>
          <Toggle label="Dark mode" size="sm" checked={dark} onCheckedChange={handleColorMode} />
          <Button variant="secondary" size="sm" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); if (name) createTournament.mutate({ name }); }}
        style={{ display: "flex", alignItems: "flex-end", gap: cssVars.space.xs, margin: `${cssVars.space.lg} 0` }}
      >
        <div style={{ flex: 1 }}>
          <InputField
            label="Tournament name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <Button type="submit" iconStart="plus" loading={createTournament.isPending} loadingLabel="Creating tournament">
          Create
        </Button>
      </form>

      {tournaments?.length === 0 && (
        <p style={{ font: cssVars.typography.body.md, color: cssVars.color.text.secondary }}>No tournaments yet.</p>
      )}
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
        {/* @ts-expect-error TS2589 tRPC+Prisma type depth */}
        {tournaments?.map((t) => {
          const status = statusTag(t.status);
          return (
            <li
              key={t.id}
              style={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: cssVars.space.sm,
                padding: `${cssVars.space.sm} 0`,
                borderBottom: `${cssVars.border.width.thin} solid ${cssVars.color.border.subtle}`,
              }}
            >
              <strong style={{ font: cssVars.typography.label.lg, color: cssVars.color.text.primary }}>
                <Link as={NextLink} href={`/tournament/${t.id}`}>{t.name}</Link>
              </strong>
              <span style={{ font: cssVars.typography.body.sm, color: cssVars.color.text.tertiary }}>
                {t.events.length} event{t.events.length !== 1 ? "s" : ""}
              </span>
              <Tag tone={status.tone} size="sm" style={{ marginLeft: "auto" }}>{status.label}</Tag>
              {t.events.length > 0 && (
                <ul style={{ flexBasis: "100%", display: "flex", flexWrap: "wrap", gap: cssVars.space.md, listStyle: "none", margin: 0, padding: 0, font: cssVars.typography.body.sm }}>
                  {t.events.map((e) => (
                    <li key={e.id}>
                      <Link as={NextLink} href={`/event/${e.id}`}>{e.name}</Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
