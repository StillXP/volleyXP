"use client";

import { useState } from "react";
import NextLink from "next/link";
import { Button, InputField, Link } from "@lockin/react";
import { cssVars } from "@lockin/tokens";
import { useRouter } from "next/navigation";
import { authClient } from "../../../lib/auth-client";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";

export default function SignUpPage() {
  useDocumentTitle("Create an account");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // Better Auth wants a name too; the server derives the real one from these two.
    const first = firstName.trim();
    const last = lastName.trim();
    const { error } = await authClient.signUp.email({
      email,
      password,
      name: `${first} ${last}`,
      firstName: first,
      lastName: last,
    });
    setLoading(false);
    if (error) {
      setError(error.message ?? "Could not create account");
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", paddingTop: cssVars.space["3xl"] }}>
      <div style={{ width: "100%", maxWidth: 400, padding: `0 ${cssVars.space.md}` }}>
        <h1 style={{ marginBottom: cssVars.space.lg, font: cssVars.typography.heading.md, color: cssVars.color.text.primary }}>Create an account</h1>

        <form onSubmit={handleEmailSignUp} style={{ display: "flex", flexDirection: "column", gap: cssVars.space.md }}>
          <InputField
            label="First name"
            type="text"
            autoComplete="given-name"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <InputField
            label="Last name"
            type="text"
            autoComplete="family-name"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p role="alert" style={{ font: cssVars.typography.body.sm, color: cssVars.color.text.danger }}>{error}</p>}
          <Button type="submit" fullWidth loading={loading} loadingLabel="Creating account…">
            Create account
          </Button>
        </form>

        <p style={{ marginTop: cssVars.space.lg, font: cssVars.typography.body.sm, textAlign: "center", color: cssVars.color.text.secondary }}>
          Already have an account?{" "}
          <Link as={NextLink} href="/sign-in">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
