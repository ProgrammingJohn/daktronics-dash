import { describe, expect, test } from "vitest";
import { ScoreboardRenderer } from "./ScoreboardRenderer";
import { sport_svgs } from "./sport_svgs";
import { get_sport } from "../sports/registry";
import type { SportId } from "../domain/session";

const sports: readonly SportId[] = ["baseball", "basketball", "football"];
const required_tokens = [
  "--home_team_light",
  "--home_team_dark",
  "--home_team_text",
  "--away_team_light",
  "--away_team_dark",
  "--away_team_text"
];

describe("canonical scoreboard assets", () => {
  test.each(sports)("%s owns ShadowRoot-safe colors and a real public font URL", (sport_id) => {
    const source = sport_svgs[sport_id];
    const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
    const style = parsed.querySelector("style")?.textContent ?? "";

    expect(parsed.querySelector("parsererror")).toBeNull();
    expect(style).not.toContain(":root");
    expect(style).toContain("/fonts/LEMONMILK-Medium.otf");
    for (const token of required_tokens) expect(style).toContain(token);
  });

  test.each(sports)("%s mutates score text inside its mounted ShadowRoot", (sport_id) => {
    const sport = get_sport(sport_id);
    const score = sport.score_schema.parse({ ...sport.initial_score, home_score: 17 });
    const renderer = new ScoreboardRenderer(document.createElement("div"));
    renderer.mount(sport_svgs[sport_id], sport.bindings);
    renderer.render(sport.derive_view(score));

    expect(
      renderer.shadowRoot.querySelector('[data-score-field="home_score"]')?.textContent
    ).toBe("17");
  });
});
