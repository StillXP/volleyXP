"use client";

import { useEffect, useRef, useState } from "react";
import { Button, InputField } from "@lockin/react";
import { cssVars } from "@lockin/tokens";
import { muted } from "../PageShell";

interface Props {
  code: string;
  rotating: boolean;
  onRotate: () => void;
}

/** The captain's link for teammates, with a copy button and a way to replace it. */
export function InviteLink({ code, rotating, onRotate }: Props) {
  // The full address needs the browser's origin, which the server doesn't have.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const url = `${origin}/join/${code}`;

  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      // No clipboard access: select the link so it can be copied by hand.
      inputRef.current?.select();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: cssVars.space.xs }}>
      <InputField
        ref={inputRef}
        label="Invite link"
        hint="Anyone with this link can join your team while there's room."
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
      />
      <div style={{ display: "flex", alignItems: "center", gap: cssVars.space.sm, flexWrap: "wrap" }}>
        <Button size="sm" onClick={copy}>Copy link</Button>
        <Button variant="secondary" size="sm" onClick={onRotate} loading={rotating} loadingLabel="Making a new link">
          Get a new link
        </Button>
        {/* Always present, so screen readers hear the change when the text appears. */}
        <span role="status" style={muted}>{copied ? "Link copied" : ""}</span>
      </div>
    </div>
  );
}
