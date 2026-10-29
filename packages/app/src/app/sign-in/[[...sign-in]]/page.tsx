"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import NextLink from "next/link";
import { Button, InputField, Link } from "@lockin/react";
import { cssVars } from "@lockin/tokens";
import { authClient } from "../../../lib/auth-client";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";

export default function SignInPage() {
  useDocumentTitle("Sign in");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await authClient.signIn.email({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message ?? "Could not sign in");
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", paddingTop: cssVars.space["3xl"] }}>
      <div style={{ width: "100%", maxWidth: 400, padding: `0 ${cssVars.space.md}` }}>
        <h1 style={{ marginBottom: cssVars.space.lg, font: cssVars.typography.heading.md, color: cssVars.color.text.primary }}>Sign in</h1>

        <form onSubmit={handleEmailSignIn} style={{ display: "flex", flexDirection: "column", gap: cssVars.space.md }}>
          <InputField
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <InputField
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p role="alert" style={{ font: cssVars.typography.body.sm, color: cssVars.color.text.danger }}>{error}</p>}
          <Button type="submit" fullWidth loading={loading} loadingLabel="Signing in…">
            Sign in
          </Button>
        </form>

        <p style={{ marginTop: cssVars.space.lg, font: cssVars.typography.body.sm, textAlign: "center", color: cssVars.color.text.secondary }}>
          Don&apos;t have an account?{" "}
          <Link as={NextLink} href="/sign-up">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
