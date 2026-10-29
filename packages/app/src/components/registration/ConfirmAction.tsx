"use client";

import { useState } from "react";
import { Button } from "@lockin/react";
import { cssVars } from "@lockin/tokens";
import { muted } from "../PageShell";

interface Props {
  /** The button that starts the action, for example "Withdraw team". */
  label: string;
  /** The question asked before anything happens. */
  prompt: string;
  confirmLabel: string;
  pending: boolean;
  pendingLabel: string;
  onConfirm: () => void;
}

/** An action that affects other people: asks first, and Cancel puts things back. */
export function ConfirmAction({ label, prompt, confirmLabel, pending, pendingLabel, onConfirm }: Props) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return <Button variant="secondary" size="sm" onClick={() => setAsking(true)}>{label}</Button>;
  }
  return (
    <div role="group" aria-label={`Confirm: ${label}`} style={{ display: "flex", alignItems: "center", gap: cssVars.space.sm, flexWrap: "wrap" }}>
      <span style={muted}>{prompt}</span>
      <Button size="sm" onClick={onConfirm} loading={pending} loadingLabel={pendingLabel}>{confirmLabel}</Button>
      <Button variant="secondary" size="sm" onClick={() => setAsking(false)}>Cancel</Button>
    </div>
  );
}
