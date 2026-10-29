// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import { expectAccessible } from "./a11y";

afterEach(cleanup);

describe("the bracket generator demo", () => {
  it("is titled, and has a single top-level heading on every step", async () => {
    render(<App />);
    expect(document.title).toBe("Bracket generator · Volley");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("has no accessibility violations on any step, through to the bracket", async () => {
    const { container } = render(<App />);
    await expectAccessible(container); // team count
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await expectAccessible(container); // elimination format
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await expectAccessible(container); // match format
    await userEvent.click(screen.getByRole("button", { name: "Generate bracket" }));
    expect(screen.getByRole("heading", { level: 1, name: "Tournament Bracket" })).toBeTruthy();
    await expectAccessible(container); // the bracket itself, with zoom controls
  });

  it("has no accessibility violations when the team count is rejected, and explains it", async () => {
    const { container } = render(<App />);
    const input = screen.getByLabelText(/Number of teams/);
    await userEvent.clear(input);
    await userEvent.type(input, "1");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Enter a number from 2 to 64")).toBeTruthy();
    expect(document.activeElement).toBe(input);
    await expectAccessible(container);
  });

  it("names its zoom controls", async () => {
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Generate bracket" }));
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeTruthy();
  });
});
