"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "../../lib/trpc";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";
import { useThemeMode } from "../../lib/ThemeContext";

export default function DashboardPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const { data: tournaments, refetch } = trpc.tournament.getAll.useQuery();
  const createTournament = trpc.tournament.create.useMutation({
    onSuccess: () => { setName(""); refetch(); },
  });
  const { mode, toggle } = useThemeMode();

  const handleSignOut = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div style={{ maxWidth: 600, margin: "2rem auto", padding: "0 1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Tournaments</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            onClick={toggle}
            aria-label="Toggle dark mode"
            style={{
              background: "none",
              border: "1px solid currentColor",
              borderRadius: "6px",
              padding: "0.25rem 0.6rem",
              cursor: "pointer",
              fontSize: "1rem",
              lineHeight: 1,
            }}
          >
            {mode === "dark" ? "☀️" : "🌙"}
          </button>
          <button
            onClick={handleSignOut}
            style={{
              background: "none",
              border: "1px solid currentColor",
              borderRadius: "6px",
              padding: "0.25rem 0.6rem",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); if (name) createTournament.mutate({ name }); }}
        style={{ display: "flex", gap: "0.5rem", margin: "1.5rem 0" }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tournament name"
          style={{ flex: 1, padding: "0.5rem" }}
        />
        <button type="submit" disabled={createTournament.isPending}>
          {createTournament.isPending ? "Creating..." : "Create"}
        </button>
      </form>

      {tournaments?.length === 0 && <p>No tournaments yet.</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
        {/* @ts-expect-error TS2589 tRPC+Prisma type depth */}
        {tournaments?.map((t) => (
          <li key={t.id} style={{ padding: "0.75rem 0", borderBottom: "1px solid #eee" }}>
            <strong>{t.name}</strong>
            <span style={{ marginLeft: "0.75rem", color: "#888", fontSize: "0.875rem" }}>
              {t.events.length} event{t.events.length !== 1 ? "s" : ""} · {t.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
