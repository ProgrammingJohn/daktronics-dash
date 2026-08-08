import type { AppearancePayload, SportId } from "../../domain/session";
import { sport_id_schema } from "../../domain/session";

type LegacyPreferences = Record<string, Record<string, string>>;

export function migrate_legacy_preferences(legacy: LegacyPreferences): AppearancePayload[] {
  const migrated: AppearancePayload[] = [];
  for (const [candidate_sport, preferences] of Object.entries(legacy)) {
    const parsed = sport_id_schema.safeParse(candidate_sport);
    if (!parsed.success) continue;
    const sport: SportId = parsed.data;
    const home_id = `${sport}-legacy-home`;
    const away_id = `${sport}-legacy-away`;
    const home_name = preferences.home_team_name ?? "home";
    const away_name = preferences.away_team_name ?? "away";
    migrated.push({
      schema_version: 1,
      sport,
      profiles: [
        {
          id: home_id,
          display_name: home_name,
          abbreviation: home_name,
          light: preferences.home_team_light ?? "#919191",
          dark: preferences.home_team_dark ?? "#004285",
          text: preferences.home_team_text ?? "#ffffff"
        },
        {
          id: away_id,
          display_name: away_name,
          abbreviation: away_name,
          light: preferences.away_team_light ?? "#dcdcdc",
          dark: preferences.away_team_dark ?? "#b2b2b2",
          text: preferences.away_team_text ?? "#004285"
        }
      ],
      appearance: {
        sport,
        home_profile_id: home_id,
        away_profile_id: away_id,
        token_overrides: {}
      }
    });
  }
  return migrated;
}
