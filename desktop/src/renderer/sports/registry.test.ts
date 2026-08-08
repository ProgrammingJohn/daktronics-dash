import { z } from "zod";
import { describe, expect, it } from "vitest";
import { get_sport, list_sports, register_sport } from "./registry";
import type { SportId, SportModule } from "./types";

function sport_module(id: SportId): SportModule<Record<string, never>, Record<string, never>> {
  return {
    id,
    display_name: id,
    supported_sources: ["manual", "synced"],
    score_schema: z.object({}),
    initial_score: {},
    derive_view: () => ({}),
    bindings: [],
    controls: [],
    appearance: {}
  };
}

describe("sport registry", () => {
  it("rejects unknown sport lookups", () => {
    expect(() => get_sport("baseball")).toThrow("Unknown sport: baseball");
  });

  it("rejects duplicate sport registration", () => {
    register_sport(sport_module("football"));

    expect(() => register_sport(sport_module("football"))).toThrow(
      "Sport already registered: football"
    );
  });

  it("lists registered modules in canonical sport order as a frozen array", () => {
    register_sport(sport_module("basketball"));
    register_sport(sport_module("baseball"));

    const sports = list_sports();

    expect(sports.map((sport) => sport.id)).toEqual(["baseball", "basketball", "football"]);
    expect(Object.isFrozen(sports)).toBe(true);
  });
});
