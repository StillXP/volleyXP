"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { Link } from "@lockin/react";
import { cssVars } from "@lockin/tokens";
import { authClient } from "../lib/auth-client";

const HIDDEN_ON = ["/sign-in", "/sign-up", "/dashboard"];

// Entry point to the account pages from the wizard, which has no header of its own.
export function AccountLink() {
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();

  if (isPending || HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  return (
    <nav
      aria-label="Account"
      style={{
        position: "fixed",
        top: cssVars.space.sm,
        right: cssVars.space.md,
        zIndex: 10,
        font: cssVars.typography.body.sm,
      }}
    >
      {session ? (
        <Link as={NextLink} href="/dashboard">
          Dashboard
        </Link>
      ) : (
        <Link as={NextLink} href="/sign-in">
          Sign in
        </Link>
      )}
    </nav>
  );
}
