import { describe, expect, test } from "vitest";
import football_svg from "../../../../../scoreboard_svgs/football.svg?raw";
import { ScoreboardRenderer } from "../../scoreboard/ScoreboardRenderer";
import { football_live } from "./fixtures";
import { football_module } from "./module";

describe("football_module", () => {
  test("parses canonical state and derives down, clock, and possession", () => {
    const score = football_module.score_schema.parse(football_live);
    const view = football_module.derive_view(score);

    expect(view.clock_text).toBe("7:04");
    expect(view.down_text).toBe("2nd & 6");
    expect(view.possession).toBe("home");
  });

  test("mounts every binding against the canonical SVG", () => {
    const renderer = new ScoreboardRenderer(document.createElement("div"));

    expect(() => renderer.mount(football_svg, football_module.bindings)).not.toThrow();
  });
});
