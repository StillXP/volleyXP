// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { expectAccessible } from "./a11y";

afterEach(cleanup);

// A check that quietly passes everything is worse than none, so prove this one can fail.
describe("the accessibility check", () => {
  it("accepts a labelled form control and a named button", async () => {
    const { container } = render(
      <form>
        <label htmlFor="n">Name</label>
        <input id="n" />
        <button type="submit">Save</button>
      </form>
    );
    await expectAccessible(container);
  });

  it.each([
    ["an unnamed button", <button type="button" />],
    ["an image with no alt text", <img src="x.png" />],
    ["an input with no label", <input type="text" />],
    ["a link with no text", <a href="/x" />],
    ["a skipped heading level", <><h1>Title</h1><h3>Skipped</h3></>],
  ])("fails %s", async (_label, tree) => {
    const { container } = render(<main>{tree}</main>);
    await expect(expectAccessible(container)).rejects.toThrow();
  });
});
