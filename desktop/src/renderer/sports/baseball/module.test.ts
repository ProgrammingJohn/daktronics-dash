import { describe, expect, test } from "vitest";
import baseball_svg from "../../../../../scoreboard_svgs/baseball.svg?raw";
import { ScoreboardRenderer } from "../../scoreboard/ScoreboardRenderer";
import { baseball_live } from "./fixtures";
import { baseball_module } from "./module";

describe("baseball_module", () => {
  test("parses canonical state and derives display text", () => {
    const score = baseball_module.score_schema.parse(baseball_live);
    const view = baseball_module.derive_view(score);

    expect(view.inning_text).toBe("top 3");
    expect(view.count_text).toBe("2 - 1");
  });

  test("mounts every binding against the canonical SVG", () => {
    const renderer = new ScoreboardRenderer(document.createElement("div"));

    expect(() => renderer.mount(baseball_svg, baseball_module.bindings)).not.toThrow();
  });
});
