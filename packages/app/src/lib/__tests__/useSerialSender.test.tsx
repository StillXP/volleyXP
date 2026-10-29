// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useSerialSender } from "../useSerialSender";

/** A send that stays in flight until the test lets it finish. */
function controlledSend() {
  const calls: number[] = [];
  const resolvers: (() => void)[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const send = vi.fn((value: number) => {
    calls.push(value);
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    return new Promise<void>((resolve) => {
      resolvers.push(() => {
        inFlight -= 1;
        resolve();
      });
    });
  });
  return { send, calls, finishOne: () => act(async () => void resolvers.shift()!()), maxInFlight: () => maxInFlight };
}

describe("useSerialSender", () => {
  it("sends a single value straight away", async () => {
    const { send, calls, finishOne } = controlledSend();
    const { result } = renderHook(() => useSerialSender(send));
    act(() => result.current.push(1));
    expect(calls).toEqual([1]);
    expect(result.current.pending).toBe(true);
    await finishOne();
    await waitFor(() => expect(result.current.pending).toBe(false));
  });

  it("turns a burst into the first value and then only the latest", async () => {
    const { send, calls, finishOne, maxInFlight } = controlledSend();
    const { result } = renderHook(() => useSerialSender(send));
    act(() => {
      result.current.push(1);
      result.current.push(2);
      result.current.push(3);
      result.current.push(4);
    });
    expect(calls).toEqual([1]); // 2 and 3 are never sent: 4 replaced them
    await finishOne();
    await waitFor(() => expect(calls).toEqual([1, 4]));
    await finishOne();
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(maxInFlight()).toBe(1); // requests never overlap
  });

  it("reports idle once, after everything has been sent", async () => {
    const { send, finishOne } = controlledSend();
    const onIdle = vi.fn();
    const { result } = renderHook(() => useSerialSender(send, { onIdle }));
    act(() => {
      result.current.push(1);
      result.current.push(2);
    });
    await finishOne();
    expect(onIdle).not.toHaveBeenCalled(); // 2 is still to go
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    await finishOne();
    await waitFor(() => expect(onIdle).toHaveBeenCalledOnce());
  });

  it("keeps going when a value arrives while it is settling", async () => {
    const { send, calls, finishOne } = controlledSend();
    let release!: () => void;
    const settling = new Promise<void>((resolve) => (release = resolve));
    const onIdle = vi.fn(() => settling);
    const { result } = renderHook(() => useSerialSender(send, { onIdle }));
    act(() => result.current.push(1));
    await finishOne();
    await waitFor(() => expect(onIdle).toHaveBeenCalledOnce());
    act(() => result.current.push(2)); // lands during onIdle
    release();
    await waitFor(() => expect(calls).toEqual([1, 2]));
    await finishOne();
    await waitFor(() => expect(result.current.pending).toBe(false));
  });

  it("starts a new run after going idle", async () => {
    const { send, calls, finishOne } = controlledSend();
    const { result } = renderHook(() => useSerialSender(send));
    act(() => result.current.push(1));
    await finishOne();
    await waitFor(() => expect(result.current.pending).toBe(false));
    act(() => result.current.push(2));
    expect(calls).toEqual([1, 2]);
    await finishOne();
  });

  it("drops what is waiting and reports the error when a send fails", async () => {
    const calls: number[] = [];
    const send = vi.fn(async (value: number) => {
      calls.push(value);
      if (value === 1) throw new Error("conflict");
    });
    const onError = vi.fn();
    const onIdle = vi.fn();
    const { result } = renderHook(() => useSerialSender(send, { onError, onIdle }));
    act(() => {
      result.current.push(1);
      result.current.push(2);
    });
    await waitFor(() => expect(onError).toHaveBeenCalledOnce());
    expect((onError.mock.calls[0]![0] as Error).message).toBe("conflict");
    expect(calls).toEqual([1]); // 2 was dropped with the failure
    expect(onIdle).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.pending).toBe(false));

    // It recovers: the next push sends normally.
    act(() => result.current.push(3));
    await waitFor(() => expect(calls).toEqual([1, 3]));
  });
});
