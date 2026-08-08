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

  test("keeps used timeout bars visible and colors them gray", () => {
    const renderer = new ScoreboardRenderer(document.createElement("div"));
    renderer.mount(football_svg, football_module.bindings);
    renderer.render(
      football_module.derive_view(
        football_module.score_schema.parse({
          ...football_live,
          home_timeouts: 2,
          away_timeouts: 1
        })
      )
    );

    const home_available = renderer.shadowRoot.querySelector<SVGElement>(
      '[data-score-field="home_timeout_1"]'
    );
    const home_used = renderer.shadowRoot.querySelector<SVGElement>(
      '[data-score-field="home_timeout_3"]'
    );
    const away_used = renderer.shadowRoot.querySelector<SVGElement>(
      '[data-score-field="away_timeout_2"]'
    );
    expect(home_available).not.toHaveAttribute("hidden");
    expect(home_available?.style.getPropertyValue("fill")).toBe("var(--home_team_text)");
    expect(home_used).not.toHaveAttribute("hidden");
    expect(home_used?.style.getPropertyValue("fill")).toBe("gray");
    expect(away_used).not.toHaveAttribute("hidden");
    expect(away_used?.style.getPropertyValue("fill")).toBe("gray");
  });
});
