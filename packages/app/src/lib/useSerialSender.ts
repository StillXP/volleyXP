import { useCallback, useRef, useState } from "react";

interface Handlers {
  /** Runs once everything pushed so far has been sent. */
  onIdle?: () => void | Promise<void>;
  /** Runs when a send fails; anything still waiting is dropped. */
  onError?: (error: unknown) => void | Promise<void>;
}

/**
 * Sends values one request at a time, always the latest one. While a request is in
 * flight, newer values replace each other, so a burst of taps becomes a first send
 * and then one send of where things ended up. Requests never overlap, so they can't
 * land out of order and overwrite a newer score with an older one.
 */
export function useSerialSender<T>(send: (value: T) => Promise<unknown>, handlers: Handlers = {}) {
  const waiting = useRef<{ value: T } | null>(null);
  const running = useRef(false);
  const [pending, setPending] = useState(false);

  // Read through refs so push stays stable and always calls the latest closures.
  const sendRef = useRef(send);
  const handlersRef = useRef(handlers);
  sendRef.current = send;
  handlersRef.current = handlers;

  const push = useCallback((value: T) => {
    waiting.current = { value };
    if (running.current) return;
    running.current = true;
    setPending(true);
    void (async () => {
      try {
        for (;;) {
          while (waiting.current) {
            const { value: next } = waiting.current;
            waiting.current = null;
            await sendRef.current(next);
          }
          await handlersRef.current.onIdle?.();
          if (!waiting.current) break; // nothing arrived while settling
        }
      } catch (error) {
        waiting.current = null;
        await handlersRef.current.onError?.(error);
      } finally {
        running.current = false;
        setPending(false);
      }
    })();
  }, []);

  return { push, pending };
}
