import { describe, expect, test } from "vitest";
import { migrate_legacy_preferences } from "./profile_migration";

describe("migrate_legacy_preferences", () => {
  test("creates deterministic team profiles without changing legacy names or colors", () => {
    const legacy = {
      football: {
        home_team_name: "hhs",
        home_team_light: "#0061ff",
        home_team_dark: "#0042aa",
        home_team_text: "#ffffff",
        away_team_name: "ccs",
        away_team_light: "#ff4013",
        away_team_dark: "#b51a00",
        away_team_text: "#ffffff"
      }
    };

    const first = migrate_legacy_preferences(legacy);
    const second = migrate_legacy_preferences(legacy);

    expect(first).toEqual(second);
    expect(first[0]?.profiles[0]).toMatchObject({
      id: "football-legacy-home",
      abbreviation: "hhs",
      light: "#0061ff",
      dark: "#0042aa",
      text: "#ffffff"
    });
    expect(first[0]?.profiles[1]).toMatchObject({
      id: "football-legacy-away",
      abbreviation: "ccs",
      light: "#ff4013"
    });
  });
});
