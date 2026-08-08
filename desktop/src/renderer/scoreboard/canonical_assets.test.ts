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
  test.each(sports)("%s owns ShadowRoot-safe colors and inherits the document font", (sport_id) => {
    const source = sport_svgs[sport_id];
    const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
    const style = parsed.querySelector("style")?.textContent ?? "";

    expect(parsed.querySelector("parsererror")).toBeNull();
    expect(style).not.toContain(":root");
    expect(style).not.toContain("@font-face");
    for (const token of required_tokens) expect(style).toContain(token);
  });

  test("renderer registers every scoreboard font weight once at document scope", () => {
    new ScoreboardRenderer(document.createElement("div"));
    new ScoreboardRenderer(document.createElement("div"));
    const styles = document.head.querySelectorAll("style[data-dakdash-scoreboard-fonts]");
    expect(styles).toHaveLength(1);
    const style = styles[0] as HTMLStyleElement;
    const font_faces = [...(style.sheet?.cssRules ?? [])]
      .filter((rule) => rule.constructor.name === "CSSFontFaceRule")
      .map((rule) => (rule as CSSFontFaceRule).style);

    expect(font_faces.map((face) => face.getPropertyValue("font-family"))).toEqual([
      '"DakDash Scoreboard"',
      '"DakDash Scoreboard"',
      '"DakDash Scoreboard"'
    ]);
    expect(font_faces.map((face) => face.getPropertyValue("font-weight"))).toEqual([
      "300",
      "500",
      "700"
    ]);
    expect(style.textContent?.match(/font-display: swap/g)).toHaveLength(3);
  });

  test.each(sports)("%s requests only registered scoreboard font weights", (sport_id) => {
    const parsed = new DOMParser().parseFromString(sport_svgs[sport_id], "image/svg+xml");
    const weights = new Set(
      [...parsed.querySelectorAll("text")].map((element) => element.getAttribute("font-weight"))
    );

    expect(parsed.querySelector("svg style")?.textContent).toContain(
      'font-family: "DakDash Scoreboard", Arial, sans-serif'
    );
    expect([...weights]).toEqual(expect.arrayContaining(["300", "700"]));
    expect([...weights].every((weight) => weight === "300" || weight === "500" || weight === "700")).toBe(true);
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
