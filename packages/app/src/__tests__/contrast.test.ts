import { describe, expect, it } from "vitest";
import { SRC_DIR, MODES, loadTokens, resolveToken, contrastRatio } from "@lockin/tokens/lib/resolve";

// jsdom can't judge colour contrast, so check it from the tokens. Lock In verifies its
// own standard pairs; this covers the surfaces and text colours this app actually uses,
// including surface.raised (the match dialog and skip link), which Lock In doesn't list.
const textColors = ["text.primary", "text.secondary", "text.tertiary", "text.danger", "text.brand", "text.link"];
const surfaces = {
  "background.default": "the page body",
  "background.subtle": "pages, the bracket area and the demo wizard",
  "surface.default": "the demo wizard card",
  "surface.raised": "the match dialog and the skip link",
};

type Resolve = (tokens: unknown, name: string, mode: string) => { value: string };
const resolve = resolveToken as Resolve;
const ratio = contrastRatio as (fg: string, bg: string) => number;

describe("text contrast on the surfaces the app uses (arena theme)", () => {
  const tokens = loadTokens({ srcDir: SRC_DIR, theme: "arena" });
  const modes = MODES as string[];

  it("has both modes to check", () => {
    expect(modes).toEqual(expect.arrayContaining(["light", "dark"]));
  });

  describe.each(modes)("%s mode", (mode) => {
    describe.each(Object.entries(surfaces))("on %s (%s)", (surface) => {
      it.each(textColors)("%s meets WCAG AA (4.5:1)", (text) => {
        const fg = resolve(tokens, `color.${text}`, mode).value;
        const bg = resolve(tokens, `color.${surface}`, mode).value;
        expect(fg.startsWith("#") && bg.startsWith("#")).toBe(true); // resolved to real colours
        expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
      });
    });
  });
});
