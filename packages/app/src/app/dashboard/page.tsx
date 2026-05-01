"use client";

import { useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { trpc } from "../../lib/trpc";

export default function DashboardPage() {
  const [name, setName] = useState("");
  const { data: tournaments, refetch } = trpc.tournament.getAll.useQuery();
  const createTournament = trpc.tournament.create.useMutation({
    onSuccess: () => { setName(""); refetch(); },
  });

  return (
    <div style={{ maxWidth: 600, margin: "2rem auto", padding: "0 1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Tournaments</h1>
        <UserButton />
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
        {tournaments?.map((t) => (
          <li key={t.id} style={{ padding: "0.75rem 0", borderBottom: "1px solid #eee" }}>
            <strong>{t.name}</strong>
            <span style={{ marginLeft: "0.75rem", color: "#888", fontSize: "0.875rem" }}>
              {t.format.replace("_", " ")} · {t.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
