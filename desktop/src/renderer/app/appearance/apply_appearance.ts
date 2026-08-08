import type { AppearancePayload } from "../../domain/session";

export function apply_appearance(root: ShadowRoot, payload: AppearancePayload): void {
  const svg = root.querySelector<SVGSVGElement>('[data-appearance-field="scoreboard_root"]');
  if (svg === null) throw new Error("Scoreboard SVG has no appearance root");
  const home = payload.profiles.find((profile) => profile.id === payload.appearance.home_profile_id);
  const away = payload.profiles.find((profile) => profile.id === payload.appearance.away_profile_id);
  if (home === undefined || away === undefined) throw new Error("Appearance references a missing team profile");

  const tokens: Record<string, string> = {
    "--home_team_light": home.light,
    "--home_team_dark": home.dark,
    "--home_team_text": home.text,
    "--away_team_light": away.light,
    "--away_team_dark": away.dark,
    "--away_team_text": away.text,
    ...payload.appearance.token_overrides
  };
  for (const [token, value] of Object.entries(tokens)) svg.style.setProperty(token, value);
  const home_name = root.querySelector('[data-appearance-field="home_team_name"]');
  const away_name = root.querySelector('[data-appearance-field="away_team_name"]');
  if (home_name === null || away_name === null) throw new Error("Scoreboard SVG has incomplete team-name bindings");
  home_name.textContent = home.abbreviation;
  away_name.textContent = away.abbreviation;
}
