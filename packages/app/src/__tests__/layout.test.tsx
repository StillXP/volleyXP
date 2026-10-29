// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// The providers need Next's runtime; the landmarks are what's under test.
vi.mock("../lib/StyledComponentsRegistry", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("../lib/TRPCProvider", () => ({ TRPCProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("../components/AccountLink", () => ({ AccountLink: () => <nav aria-label="Account"><a href="/sign-in">Sign in</a></nav> }));

import RootLayout from "../app/layout";

const render = () =>
  new DOMParser().parseFromString(renderToStaticMarkup(<RootLayout><h1>Page</h1></RootLayout>), "text/html");

describe("root layout landmarks", () => {
  it("wraps every page in one main landmark that the skip link can target", () => {
    const doc = render();
    const mains = doc.querySelectorAll("main");
    expect(mains).toHaveLength(1);
    expect(mains[0]!.id).toBe("main-content");
    expect(mains[0]!.querySelector("h1")?.textContent).toBe("Page");
  });

  it("offers a skip link as the first thing in the page, pointing at main", () => {
    const doc = render();
    const first = doc.body.querySelector("a, button, input")!;
    expect(first.textContent).toBe("Skip to main content");
    expect(first.getAttribute("href")).toBe("#main-content");
  });

  it("declares the language", () => {
    expect(render().documentElement.lang).toBe("en");
  });
});
