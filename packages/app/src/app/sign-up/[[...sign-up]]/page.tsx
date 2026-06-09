"use client";

import { useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "../../../lib/supabase/client";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const supabase = getSupabaseBrowserClient();

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setVerificationSent(true);
    }
  };

  const handleGoogleSignUp = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  if (verificationSent) {
    return (
      <div style={{ display: "flex", justifyContent: "center", paddingTop: "4rem" }}>
        <div style={{ maxWidth: 400, textAlign: "center", padding: "0 1rem" }}>
          <h1 style={{ marginBottom: "1rem", fontSize: "1.5rem", fontWeight: 700 }}>Check your email</h1>
          <p style={{ color: "#6b7280" }}>
            We sent a verification link to <strong>{email}</strong>. Click it to activate your account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", paddingTop: "4rem" }}>
      <div style={{ width: "100%", maxWidth: 400, padding: "0 1rem" }}>
        <h1 style={{ marginBottom: "1.5rem", fontSize: "1.5rem", fontWeight: 700 }}>Create an account</h1>

        <form onSubmit={handleEmailSignUp} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ padding: "0.625rem", borderRadius: 6, border: "1px solid #ccc", fontSize: "1rem" }}
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ padding: "0.625rem", borderRadius: 6, border: "1px solid #ccc", fontSize: "1rem" }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ padding: "0.625rem", borderRadius: 6, border: "1px solid #ccc", fontSize: "1rem" }}
          />
          {error && <p style={{ color: "red", fontSize: "0.875rem", margin: 0 }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "0.625rem",
              borderRadius: 6,
              border: "none",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 600,
              fontSize: "1rem",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", margin: "1.25rem 0" }}>
          <hr style={{ flex: 1, borderColor: "#e5e7eb" }} />
          <span style={{ fontSize: "0.875rem", color: "#6b7280" }}>or</span>
          <hr style={{ flex: 1, borderColor: "#e5e7eb" }} />
        </div>

        <button
          onClick={handleGoogleSignUp}
          style={{
            width: "100%",
            padding: "0.625rem",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            background: "#fff",
            fontWeight: 600,
            fontSize: "1rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
          }}
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <p style={{ marginTop: "1.25rem", fontSize: "0.875rem", textAlign: "center", color: "#6b7280" }}>
          Already have an account?{" "}
          <Link href="/sign-in" style={{ color: "#2563eb", fontWeight: 600 }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  );
}
