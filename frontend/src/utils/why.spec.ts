import { describe, expect, it } from "vitest";
import { shownWhy, whyBelow } from "./why";

const inherited = { text: "Gesund bleiben", fromId: 1, fromTitle: "Fit" };

describe("shownWhy", () => {
  it("prefers the own reason, then the inherited one", () => {
    expect(shownWhy({ why: "Eigenes", inheritedWhy: inherited })).toBe(
      "Eigenes",
    );
    expect(shownWhy({ why: null, inheritedWhy: inherited })).toBe(
      "Gesund bleiben",
    );
    expect(shownWhy({ why: null, inheritedWhy: null })).toBeNull();
  });
});

describe("whyBelow", () => {
  it("passes the parent's own reason down, naming the parent", () => {
    expect(
      whyBelow({ id: 2, title: "Laufen", why: "Kopf frei", inheritedWhy: inherited }),
    ).toEqual({ text: "Kopf frei", fromId: 2, fromTitle: "Laufen" });
  });
  it("passes on what the parent itself inherits", () => {
    expect(
      whyBelow({ id: 2, title: "Laufen", why: null, inheritedWhy: inherited }),
    ).toEqual(inherited);
    expect(
      whyBelow({ id: 2, title: "Laufen", why: null, inheritedWhy: null }),
    ).toBeNull();
  });
});
