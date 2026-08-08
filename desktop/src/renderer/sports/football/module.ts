import { z } from "zod";
import type { SportModule, SvgBinding } from "../types";
import { format_period, timeout_visibility } from "../basketball/module";

const football_clock_schema = z
  .object({
    minutes: z.coerce.number().int().min(0).max(99),
    seconds: z.coerce.number().int().min(0).max(59)
  })
  .strict();

export const football_score_schema = z
  .object({
    home_team_name: z.string().min(1).default("home"),
    away_team_name: z.string().min(1).default("away"),
    home_score: z.coerce.number().int().nonnegative(),
    away_score: z.coerce.number().int().nonnegative(),
    clock: football_clock_schema,
    period: z.coerce.number().int().nonnegative(),
    down: z.coerce.number().int().min(1).max(4),
    yards: z.coerce.number().int().nonnegative(),
    home_timeouts: z.coerce.number().int().min(0).max(3),
    away_timeouts: z.coerce.number().int().min(0).max(3),
    home_possesion: z.boolean()
  })
  .strict();

export type FootballScore = z.infer<typeof football_score_schema>;

export interface FootballView {
  home_team_name: string;
  away_team_name: string;
  home_score: string;
  away_score: string;
  clock_text: string;
  period_text: string;
  down_text: string;
  home_timeouts: readonly boolean[];
  away_timeouts: readonly boolean[];
  possession: "home" | "away";
}

export function format_football_clock(clock: FootballScore["clock"]): string {
  return `${clock.minutes}:${String(clock.seconds).padStart(2, "0")}`;
}

export function format_down(down: number, yards: number): string {
  const ordinal = ["", "1st", "2nd", "3rd", "4th"][down] ?? "";
  return `${ordinal} & ${yards}`;
}

export function possession_team(home_possesion: boolean): "home" | "away" {
  return home_possesion ? "home" : "away";
}

function timeout_bindings(team: "home" | "away"): SvgBinding<FootballView>[] {
  return [1, 2, 3].map((slot) => ({
    operation: "visibility" as const,
    selector: `[data-score-field="${team}_timeout_${slot}"]`,
    visible: (view: FootballView) => view[`${team}_timeouts`][slot - 1] ?? false
  }));
}

const bindings: readonly SvgBinding<FootballView>[] = [
  { operation: "text", selector: '[data-score-field="home_team_name"]', value: (view) => view.home_team_name },
  { operation: "text", selector: '[data-score-field="away_team_name"]', value: (view) => view.away_team_name },
  { operation: "text", selector: '[data-score-field="home_score"]', value: (view) => view.home_score },
  { operation: "text", selector: '[data-score-field="away_score"]', value: (view) => view.away_score },
  { operation: "text", selector: '[data-score-field="clock"]', value: (view) => view.clock_text },
  { operation: "text", selector: '[data-score-field="period"]', value: (view) => view.period_text },
  { operation: "text", selector: '[data-score-field="down_text"]', value: (view) => view.down_text },
  { operation: "attribute", selector: '[data-score-field="possession"]', attribute: "data-possession", value: (view) => view.possession },
  ...timeout_bindings("home"),
  ...timeout_bindings("away")
];

export const football_module: SportModule<FootballScore, FootballView> = {
  id: "football",
  display_name: "Football",
  supported_sources: ["manual", "synced"],
  score_schema: football_score_schema,
  initial_score: football_score_schema.parse({
    home_score: 0,
    away_score: 0,
    clock: { minutes: 0, seconds: 0 },
    period: 1,
    down: 1,
    yards: 10,
    home_timeouts: 3,
    away_timeouts: 3,
    home_possesion: true
  }),
  derive_view: (score) => ({
    home_team_name: score.home_team_name,
    away_team_name: score.away_team_name,
    home_score: String(score.home_score),
    away_score: String(score.away_score),
    clock_text: format_football_clock(score.clock),
    period_text: format_period(score.period),
    down_text: format_down(score.down, score.yards),
    home_timeouts: [1, 2, 3].map((slot) => timeout_visibility(score.home_timeouts, slot)),
    away_timeouts: [1, 2, 3].map((slot) => timeout_visibility(score.away_timeouts, slot)),
    possession: possession_team(score.home_possesion)
  }),
  bindings,
  controls: [
    { id: "home_score", kind: "counter", label: "Home score", shortcut: "h", min: 0, max: 99, value: (score) => score.home_score, reduce: (score, input) => ({ ...score, home_score: Number(input) }) },
    { id: "away_score", kind: "counter", label: "Away score", shortcut: "a", min: 0, max: 99, value: (score) => score.away_score, reduce: (score, input) => ({ ...score, away_score: Number(input) }) },
    { id: "clock", kind: "clock", label: "Game clock", value: (score) => score.clock, reduce: (score, input) => ({ ...score, clock: input as { minutes: number; seconds: number } }) },
    { id: "period", kind: "counter", label: "Period", min: 0, max: 12, value: (score) => score.period, reduce: (score, input) => ({ ...score, period: Number(input) }) },
    { id: "down", kind: "counter", label: "Down", min: 1, max: 4, value: (score) => score.down, reduce: (score, input) => ({ ...score, down: Number(input) }) },
    { id: "yards", kind: "counter", label: "Yards to go", min: 0, max: 99, value: (score) => score.yards, reduce: (score, input) => ({ ...score, yards: Number(input) }) },
    { id: "home_timeouts", kind: "counter", label: "Home timeouts", shortcut: "t", shortcut_delta: -1, min: 0, max: 3, value: (score) => score.home_timeouts, reduce: (score, input) => ({ ...score, home_timeouts: Number(input) }) },
    { id: "away_timeouts", kind: "counter", label: "Away timeouts", shortcut: "y", shortcut_delta: -1, min: 0, max: 3, value: (score) => score.away_timeouts, reduce: (score, input) => ({ ...score, away_timeouts: Number(input) }) },
    { id: "home_possesion", kind: "toggle", label: "Home possession", shortcut: "p", value: (score) => score.home_possesion, reduce: (score, input) => ({ ...score, home_possesion: Boolean(input) }) }
  ],
  appearance: {
    tokens: [
      "--home_team_light",
      "--home_team_dark",
      "--home_team_text",
      "--away_team_light",
      "--away_team_dark",
      "--away_team_text"
    ],
    name_fields: ["home_team_name", "away_team_name"]
  }
};
