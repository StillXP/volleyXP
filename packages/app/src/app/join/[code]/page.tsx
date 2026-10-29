"use client";

import NextLink from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button, Link } from "@lockin/react";
import { cssVars } from "@lockin/tokens";
import { trpc } from "../../../lib/trpc";
import { authClient } from "../../../lib/auth-client";
import { withNext } from "../../../lib/safeNext";
import { useDocumentTitle } from "../../../lib/useDocumentTitle";
import { Page, errorText, heading, muted } from "../../../components/PageShell";

/** Where a teammate lands from a captain's invite link. */
export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  // No retries: a link that isn't valid won't become valid by asking again.
  const invite = trpc.registration.getInvite.useQuery({ code }, { retry: false });
  const join = trpc.registration.join.useMutation({ onSuccess: ({ eventId }) => router.push(`/event/${eventId}`) });

  const data = invite.data;
  useDocumentTitle(data ? `Join ${data.teamName}` : invite.isLoading ? "Loading invite" : "Invite link not valid");

  if (invite.isLoading) {
    return <Page><p role="status" style={muted}>Loading invite…</p></Page>;
  }
  if (!data) {
    return (
      <Page>
        <h1 style={heading}>This invite link isn&apos;t valid</h1>
        <p style={{ ...muted, marginTop: cssVars.space.sm }}>
          The team may have withdrawn, or the captain made a new link. Ask them to send you the latest one.
        </p>
        <p style={{ marginTop: cssVars.space.md }}><Link as={NextLink} href="/">Back to Volley</Link></p>
      </Page>
    );
  }

  const here = `/join/${code}`;
  const full = data.spotsLeft === 0;
  return (
    <Page>
      <h1 style={{ font: cssVars.typography.heading.lg, color: cssVars.color.text.primary }}>Join {data.teamName}</h1>
      <p style={{ ...muted, marginTop: cssVars.space.sm }}>
        {data.captain ? `${data.captain} is putting a team together` : "A team is forming"} for{" "}
        <Link as={NextLink} href={`/event/${data.event.id}`}>{data.event.name}</Link> in {data.event.tournament.name}.
      </p>
      <p style={{ ...muted, marginTop: cssVars.space.xs }}>
        {full ? "This team is full." : `${data.spotsLeft} spot${data.spotsLeft === 1 ? "" : "s"} left.`}
      </p>

      <div style={{ marginTop: cssVars.space.lg, display: "flex", flexDirection: "column", gap: cssVars.space.sm }}>
        {!data.registrationOpen ? (
          <p style={muted}>Registration is closed, so no one can join right now.</p>
        ) : full ? (
          <p style={muted}>There&apos;s no room left, so ask the captain if a spot opens up.</p>
        ) : !session ? (
          <p style={muted}>
            <Link as={NextLink} href={withNext("/sign-in", here)}>Sign in</Link> or{" "}
            <Link as={NextLink} href={withNext("/sign-up", here)}>create an account</Link> to join.
          </p>
        ) : (
          <>
            {join.error ? <p role="alert" style={errorText}>{join.error.message}</p> : null}
            <div>
              <Button onClick={() => join.mutate({ code })} loading={join.isPending} loadingLabel="Joining team">
                Join {data.teamName}
              </Button>
            </div>
          </>
        )}
      </div>
    </Page>
  );
}
