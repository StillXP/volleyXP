"use client";

import { useState } from "react";
import { Button, InputField } from "@lockin/react";
import { cssVars } from "@lockin/tokens";
import { trpc } from "../../lib/trpc";
import { errorText } from "../PageShell";

interface Props {
  eventId: string;
  /** Called after the team is registered, so the caller can refetch. */
  onChanged: () => Promise<unknown> | void;
}

/** Starts a team. The name is optional: a blank one becomes the members' last names. */
export function RegisterTeamForm({ eventId, onChanged }: Props) {
  const [name, setName] = useState("");
  const register = trpc.registration.register.useMutation({
    onSuccess: async () => {
      setName("");
      await onChanged();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = name.trim();
        register.mutate({ eventId, ...(trimmed && { name: trimmed }) });
      }}
      style={{ display: "flex", flexDirection: "column", gap: cssVars.space.sm }}
    >
      <InputField
        label="Team name (optional)"
        hint="Leave it blank and your team is named after your last names, like Kim/Lopez."
        maxLength={60}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      {register.error ? <p role="alert" style={errorText}>{register.error.message}</p> : null}
      <div>
        <Button type="submit" loading={register.isPending} loadingLabel="Registering team">Register team</Button>
      </div>
    </form>
  );
}
