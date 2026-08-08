import { describe, expect, test } from "vitest";
import basketball_svg from "../../../../../scoreboard_svgs/basketball.svg?raw";
import { ScoreboardRenderer } from "../../scoreboard/ScoreboardRenderer";
import { basketball_live } from "./fixtures";
import { basketball_module } from "./module";

describe("basketball_module", () => {
  test("parses canonical state and derives formatted clock and period", () => {
    const score = basketball_module.score_schema.parse(basketball_live);
    const view = basketball_module.derive_view(score);

    expect(view.clock_text).toBe("7:04");
    expect(view.period_text).toBe("3rd");
  });

  test("mounts every binding against the canonical SVG", () => {
    const renderer = new ScoreboardRenderer(document.createElement("div"));

    expect(() => renderer.mount(basketball_svg, basketball_module.bindings)).not.toThrow();
  });

  test("shows an active bonus label without a legacy inline display override", () => {
    const renderer = new ScoreboardRenderer(document.createElement("div"));
    const score = basketball_module.score_schema.parse(basketball_live);
    renderer.mount(basketball_svg, basketball_module.bindings);

    renderer.render(basketball_module.derive_view(score));

    const bonus = renderer.shadowRoot.querySelector<SVGElement>(
      '[data-score-field="home_bonus"]'
    );
    expect(bonus).not.toHaveAttribute("hidden");
    expect(bonus?.style.display).not.toBe("none");
  });
});
