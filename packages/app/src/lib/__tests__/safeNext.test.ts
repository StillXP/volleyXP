import { describe, expect, it } from "vitest";
import { safeNext, withNext } from "../safeNext";

describe("safeNext", () => {
  it.each([
    ["/event/abc", "/event/abc"],
    ["/join/Xy_9-z", "/join/Xy_9-z"],
    ["/tournament/t1?tab=events", "/tournament/t1?tab=events"],
    ["/event/abc#teams", "/event/abc#teams"],
    ["/", "/"],
  ])("follows %s", (value, expected) => {
    expect(safeNext(value)).toBe(expected);
  });

  it.each([
    ["nothing", undefined],
    ["null", null],
    ["an empty string", ""],
    ["a full URL to another site", "https://evil.example/phish"],
    ["a URL with this site's look-alike host", "https://volley.example.evil.com/"],
    ["a protocol-relative URL", "//evil.example"],
    ["a protocol-relative URL with a tab smuggled in", "/\t/evil.example"],
    ["a protocol-relative URL with a newline smuggled in", "/\n/evil.example"],
    ["a backslash trick", "/\\evil.example"],
    ["a backslash anywhere", "/event\\..\\evil"],
    ["a javascript: URL", "javascript:alert(1)"],
    ["a relative path without a leading slash", "event/abc"],
    ["a data URL", "data:text/html,<script>1</script>"],
  ])("falls back for %s", (_label, value) => {
    expect(safeNext(value)).toBe("/dashboard");
  });

  it("uses the fallback it is given", () => {
    expect(safeNext("https://evil.example", "/")).toBe("/");
    expect(safeNext(null, "/create")).toBe("/create");
  });
});

describe("withNext", () => {
  it("encodes the destination so it survives a query string", () => {
    expect(withNext("/sign-in", "/join/abc")).toBe("/sign-in?next=%2Fjoin%2Fabc");
    expect(withNext("/sign-up", "/event/a?b=c&d=e")).toBe("/sign-up?next=%2Fevent%2Fa%3Fb%3Dc%26d%3De");
  });

  it("round-trips through safeNext", () => {
    const link = withNext("/sign-in", "/event/a?b=c&d=e#x");
    const next = new URL(link, "http://localhost").searchParams.get("next");
    expect(safeNext(next)).toBe("/event/a?b=c&d=e#x");
  });
});
