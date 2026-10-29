import { describe, expect, it } from "vitest";
import { defaultTeamName } from "../teamName";

const person = (firstName: string, lastName: string) => ({ firstName, lastName });

describe("defaultTeamName", () => {
  it("is the captain's last name while the team is just them", () => {
    expect(defaultTeamName([person("Alex", "Kim")])).toBe("Kim");
  });

  it("joins two players' last names with a slash, captain first", () => {
    expect(defaultTeamName([person("Alex", "Kim"), person("Sam", "Lopez")])).toBe("Kim/Lopez");
  });

  it("shows the first two and a count for a larger team", () => {
    const six = ["Kim", "Lopez", "Okafor", "Patel", "Quinn", "Reid"].map((last) => person("A", last));
    expect(defaultTeamName(six)).toBe("Kim/Lopez +4");
    expect(defaultTeamName(six.slice(0, 3))).toBe("Kim/Lopez +1");
  });

  it("keeps multi-word surnames whole", () => {
    expect(defaultTeamName([person("Maria", "de la Cruz"), person("Sam", "Lopez")])).toBe("de la Cruz/Lopez");
  });

  it("falls back to the first name for someone with no last name", () => {
    expect(defaultTeamName([person("Cher", ""), person("Sam", "Lopez")])).toBe("Cher/Lopez");
    expect(defaultTeamName([person("Cher", "   ")])).toBe("Cher");
  });

  it("trims names, and is empty when there is nobody", () => {
    expect(defaultTeamName([person(" Alex ", " Kim ")])).toBe("Kim");
    expect(defaultTeamName([])).toBe("");
    expect(defaultTeamName([person("", "")])).toBe("");
  });
});
