"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, InputField, Tag, Toggle, getResolvedColorMode, setColorMode } from "@lockin/react";
import type { TagTone } from "@lockin/react";
import { cssVars } from "@lockin/tokens";
import { trpc } from "../../lib/trpc";
import { authClient } from "../../lib/auth-client";

const STATUS_TAG: Record<string, { label: string; tone: TagTone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  REGISTRATION: { label: "Registration", tone: "info" },
  IN_PROGRESS: { label: "In progress", tone: "brand" },
  COMPLETED: { label: "Completed", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
};

export default function DashboardPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const { data: tournaments, refetch } = trpc.tournament.getAll.useQuery();
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
          const status = STATUS_TAG[t.status] ?? { label: t.status, tone: "neutral" as const };
          return (
            <li
              key={t.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: cssVars.space.sm,
                padding: `${cssVars.space.sm} 0`,
                borderBottom: `${cssVars.border.width.thin} solid ${cssVars.color.border.subtle}`,
              }}
            >
              <strong style={{ font: cssVars.typography.label.lg, color: cssVars.color.text.primary }}>{t.name}</strong>
              <span style={{ font: cssVars.typography.body.sm, color: cssVars.color.text.tertiary }}>
                {t.events.length} event{t.events.length !== 1 ? "s" : ""}
              </span>
              <Tag tone={status.tone} size="sm" style={{ marginLeft: "auto" }}>{status.label}</Tag>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
