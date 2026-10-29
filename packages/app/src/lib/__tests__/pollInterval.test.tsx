// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { CLOSED_POLL_MS, LIVE_POLL_MS, REGISTRATION_POLL_MS, WAITING_POLL_MS, matchPollInterval, registrationPollInterval } from "../pollInterval";

const m = (status: string) => ({ status });

describe("matchPollInterval", () => {
  it("doesn't poll before there is any data, or with no matches", () => {
    expect(matchPollInterval(undefined)).toBe(false);
    expect(matchPollInterval([])).toBe(false);
  });

  it("polls fast while any match is live", () => {
    expect(matchPollInterval([m("IN_PROGRESS"), m("SCHEDULED"), m("COMPLETED")])).toBe(LIVE_POLL_MS);
    expect(matchPollInterval([m("IN_PROGRESS")])).toBe(LIVE_POLL_MS);
  });

  it("polls slowly while matches are still to come but none is live", () => {
    expect(matchPollInterval([m("SCHEDULED"), m("SCHEDULED")])).toBe(WAITING_POLL_MS);
    expect(matchPollInterval([m("COMPLETED"), m("SCHEDULED")])).toBe(WAITING_POLL_MS);
  });

  it("stops once everything is finished or cancelled", () => {
    expect(matchPollInterval([m("COMPLETED"), m("COMPLETED")])).toBe(false);
    expect(matchPollInterval([m("COMPLETED"), m("CANCELLED")])).toBe(false);
  });

  it("is quicker for live play than for waiting", () => {
    expect(LIVE_POLL_MS).toBeLessThan(WAITING_POLL_MS);
  });
});

// The policy as the page uses it: handed to a real query as its refetchInterval.
describe("matchPollInterval driving a query", () => {
  let status: string;
  let calls: number;
  const fetchMatches = async () => {
    calls += 1;
    return [{ status }];
  };

  function Polled() {
    useQuery({ queryKey: ["matches"], queryFn: fetchMatches, refetchInterval: (q) => matchPollInterval(q.state.data) });
    return null;
  }
  const mount = () => render(<QueryClientProvider client={new QueryClient()}><Polled /></QueryClientProvider>);
  const advance = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

  beforeEach(() => {
    vi.useFakeTimers();
    calls = 0;
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("keeps fetching every few seconds while a match is live", async () => {
    status = "IN_PROGRESS";
    mount();
    await advance(0);
    expect(calls).toBe(1);
    await advance(LIVE_POLL_MS);
    expect(calls).toBe(2);
    await advance(LIVE_POLL_MS * 3);
    expect(calls).toBe(5);
  });

  it("waits longer when no match is live", async () => {
    status = "SCHEDULED";
    mount();
    await advance(0);
    await advance(LIVE_POLL_MS * 4); // 12s: not yet
    expect(calls).toBe(1);
    await advance(WAITING_POLL_MS - LIVE_POLL_MS * 4);
    expect(calls).toBe(2);
  });

  it("speeds up when a match goes live, and stops once everything is done", async () => {
    status = "SCHEDULED";
    mount();
    await advance(0);
    status = "IN_PROGRESS";
    await advance(WAITING_POLL_MS); // picks up the change on the slow poll
    expect(calls).toBe(2);
    await advance(LIVE_POLL_MS); // now fast
    expect(calls).toBe(3);

    status = "COMPLETED";
    await advance(LIVE_POLL_MS);
    expect(calls).toBe(4);
    await advance(WAITING_POLL_MS * 4); // finished: no more requests
    expect(calls).toBe(4);
  });
});

describe("registrationPollInterval", () => {
  it("polls steadily while registration is open, and more slowly once it has closed", () => {
    expect(registrationPollInterval("REGISTRATION")).toBe(REGISTRATION_POLL_MS);
    expect(registrationPollInterval("SEEDING")).toBe(CLOSED_POLL_MS);
    expect(REGISTRATION_POLL_MS).toBeLessThan(CLOSED_POLL_MS);
  });

  it.each(["DRAFT", "IN_PROGRESS", "COMPLETED", undefined])("doesn't poll for %s", (status) => {
    expect(registrationPollInterval(status)).toBe(false);
  });
});
