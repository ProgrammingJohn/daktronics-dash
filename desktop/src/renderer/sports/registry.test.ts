import { describe, expect, it } from "vitest";
import { baseball_module } from "./baseball/module";
import { get_sport, list_sports, register_sport } from "./registry";
import type { SportId } from "./types";

describe("sport registry", () => {
  it("rejects unknown sport lookups", () => {
    expect(() => get_sport("lacrosse" as SportId)).toThrow("Unknown sport: lacrosse");
  });

  it("rejects duplicate sport registration", () => {
    expect(() => register_sport(baseball_module)).toThrow(
      "Sport already registered: baseball"
    );
  });

  it("lists registered modules in canonical sport order as a frozen array", () => {
    const sports = list_sports();

    expect(sports.map((sport) => sport.id)).toEqual(["baseball", "basketball", "football"]);
    expect(Object.isFrozen(sports)).toBe(true);
  });
});
