import { describe, expect, it } from "vitest";

import { buildRenderValues, formatClockText, formatDownText, formatPeriod } from "@/utils/scoreFormat";

describe("score formatting", () => {
  it("formats period for football", () => {
    expect(formatPeriod(1, "football")).toBe("1st");
    expect(formatPeriod(4, "football")).toBe("4th");
    expect(formatPeriod(5, "football")).toBe("ot1");
  });

  it("prefers clock_text when present", () => {
    expect(formatClockText({ clock_text: "12:34" })).toBe("12:34");
    expect(formatClockText({ clock: { minutes: 8, seconds: 3 } })).toBe("8:03");
  });

  it("formats down and yards", () => {
    expect(formatDownText({ down: 2, yards_to_go: 7 })).toBe("2nd & 7");
  });

  it("buildRenderValues includes derived down_text", () => {
    const values = buildRenderValues({ down: 3, yards_to_go: 1, period: 2, clock: { minutes: 5, seconds: 9 } }, "football");
    expect(values.down_text).toBe("3rd & 1");
    expect(values.period).toBe("2nd");
    expect(values.clock_text).toBe("5:09");
  });
});
