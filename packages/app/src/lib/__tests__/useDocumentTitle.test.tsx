// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDocumentTitle } from "../useDocumentTitle";

describe("useDocumentTitle", () => {
  it("adds the site name, and puts the old title back when the page goes away", () => {
    document.title = "Volley";
    const { unmount } = renderHook(() => useDocumentTitle("Summer Open"));
    expect(document.title).toBe("Summer Open · Volley");
    unmount();
    expect(document.title).toBe("Volley");
  });

  it("follows the title as it changes", () => {
    document.title = "Volley";
    const { rerender } = renderHook(({ title }) => useDocumentTitle(title), { initialProps: { title: "Loading event" } });
    expect(document.title).toBe("Loading event · Volley");
    rerender({ title: "Mixed Doubles" });
    expect(document.title).toBe("Mixed Doubles · Volley");
  });

  it("leaves the title alone while there is none", () => {
    document.title = "Volley";
    renderHook(() => useDocumentTitle(undefined));
    expect(document.title).toBe("Volley");
  });
});
