import { expect } from "vitest";
import { configureAxe } from "vitest-axe";
import * as matchers from "vitest-axe/matchers";

expect.extend(matchers);

// jsdom has no layout or painting, so two rules can't be judged here:
// - color-contrast needs real rendering; token pairs are checked against Lock In's own
//   contrast data instead.
// - region (everything inside a landmark) fails for a component rendered on its own;
//   page tests assert the <main> landmark directly.
const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
    region: { enabled: false },
  },
});

/** Fails with axe's own report if the rendered tree has an accessibility violation. */
export async function expectAccessible(container: Element) {
  expect(await axe(container)).toHaveNoViolations();
}
