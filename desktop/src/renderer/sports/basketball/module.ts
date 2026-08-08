import { z } from "zod";
import type { SportModule, SvgBinding } from "../types";

export const basketball_score_schema = z
  .object({
    home_team_name: z.string().min(1).default("home"),
    away_team_name: z.string().min(1).default("away"),
    home_score: z.coerce.number().int().nonnegative(),
    away_score: z.coerce.number().int().nonnegative(),
    home_fouls: z.coerce.number().int().nonnegative(),
    away_fouls: z.coerce.number().int().nonnegative(),
    home_bonus: z.boolean(),
    away_bonus: z.boolean(),
    home_timeouts: z.coerce.number().int().min(0).max(5),
    away_timeouts: z.coerce.number().int().min(0).max(5),
    period: z.coerce.number().int().nonnegative(),
    clock: z.string().regex(/^\d{1,2}:\d{2}$/)
  })
  .strict();

export type BasketballScore = z.infer<typeof basketball_score_schema>;

export interface BasketballView {
  home_team_name: string;
  away_team_name: string;
  home_score: string;
  away_score: string;
  home_fouls_text: string;
  away_fouls_text: string;
  home_bonus: boolean;
  away_bonus: boolean;
  home_timeouts: readonly boolean[];
  away_timeouts: readonly boolean[];
  clock_text: string;
  period_text: string;
}

export function format_period(period: number): string {
  if (period === 0) return "pre";
  if (period === 1) return "1st";
  if (period === 2) return "2nd";
  if (period === 3) return "3rd";
  if (period === 4) return "4th";
  return `ot${period - 4}`;
}

export function format_clock(clock: string): string {
  const [minutes, seconds] = clock.split(":");
  return `${Number(minutes)}:${seconds}`;
}

export function timeout_visibility(remaining: number, slot: number): boolean {
  return slot <= remaining;
}

function timeout_bindings(team: "home" | "away"): SvgBinding<BasketballView>[] {
  return [1, 2, 3, 4, 5].map((slot) => ({
    operation: "visibility" as const,
    selector: `[data-score-field="${team}_timeout_${slot}"]`,
    visible: (view: BasketballView) => view[`${team}_timeouts`][slot - 1] ?? false
  }));
}

const bindings: readonly SvgBinding<BasketballView>[] = [
  { operation: "text", selector: '[data-score-field="home_team_name"]', value: (view) => view.home_team_name },
  { operation: "text", selector: '[data-score-field="away_team_name"]', value: (view) => view.away_team_name },
  { operation: "text", selector: '[data-score-field="home_score"]', value: (view) => view.home_score },
  { operation: "text", selector: '[data-score-field="away_score"]', value: (view) => view.away_score },
  { operation: "text", selector: '[data-score-field="home_fouls"]', value: (view) => view.home_fouls_text },
  { operation: "text", selector: '[data-score-field="away_fouls"]', value: (view) => view.away_fouls_text },
  { operation: "visibility", selector: '[data-score-field="home_bonus"]', visible: (view) => view.home_bonus },
  { operation: "visibility", selector: '[data-score-field="away_bonus"]', visible: (view) => view.away_bonus },
  { operation: "text", selector: '[data-score-field="clock"]', value: (view) => view.clock_text },
  { operation: "text", selector: '[data-score-field="period"]', value: (view) => view.period_text },
  ...timeout_bindings("home"),
  ...timeout_bindings("away")
];

export const basketball_module: SportModule<BasketballScore, BasketballView> = {
  id: "basketball",
  display_name: "Basketball",
  supported_sources: ["manual", "synced"],
  score_schema: basketball_score_schema,
  initial_score: basketball_score_schema.parse({
    home_score: 0,
    away_score: 0,
    home_fouls: 0,
    away_fouls: 0,
    home_bonus: false,
    away_bonus: false,
    home_timeouts: 5,
    away_timeouts: 5,
    period: 1,
    clock: "0:00"
  }),
  derive_view: (score) => ({
    home_team_name: score.home_team_name,
    away_team_name: score.away_team_name,
    home_score: String(score.home_score),
    away_score: String(score.away_score),
    home_fouls_text: `${score.home_fouls} FOUL${score.home_fouls === 1 ? "" : "S"}`,
    away_fouls_text: `${score.away_fouls} FOUL${score.away_fouls === 1 ? "" : "S"}`,
    home_bonus: score.home_bonus,
    away_bonus: score.away_bonus,
    home_timeouts: [1, 2, 3, 4, 5].map((slot) => timeout_visibility(score.home_timeouts, slot)),
    away_timeouts: [1, 2, 3, 4, 5].map((slot) => timeout_visibility(score.away_timeouts, slot)),
    clock_text: format_clock(score.clock),
    period_text: format_period(score.period)
  }),
  bindings,
  controls: [
    { id: "home_score", kind: "counter", label: "Home score", shortcut: "h", min: 0, max: 199, value: (score) => score.home_score, reduce: (score, input) => ({ ...score, home_score: Number(input) }) },
    { id: "away_score", kind: "counter", label: "Away score", shortcut: "a", min: 0, max: 199, value: (score) => score.away_score, reduce: (score, input) => ({ ...score, away_score: Number(input) }) },
    { id: "clock", kind: "clock", label: "Game clock", value: (score) => { const [minutes, seconds] = score.clock.split(":"); return { minutes: Number(minutes), seconds: Number(seconds) }; }, reduce: (score, input) => { const clock = input as { minutes: number; seconds: number }; return { ...score, clock: `${clock.minutes}:${String(clock.seconds).padStart(2, "0")}` }; } },
    { id: "period", kind: "counter", label: "Period", min: 0, max: 12, value: (score) => score.period, reduce: (score, input) => ({ ...score, period: Number(input) }) },
    { id: "home_fouls", kind: "counter", label: "Home fouls", min: 0, max: 99, value: (score) => score.home_fouls, reduce: (score, input) => ({ ...score, home_fouls: Number(input), away_bonus: Number(input) >= 5 }) },
    { id: "away_fouls", kind: "counter", label: "Away fouls", min: 0, max: 99, value: (score) => score.away_fouls, reduce: (score, input) => ({ ...score, away_fouls: Number(input), home_bonus: Number(input) >= 5 }) },
    { id: "home_timeouts", kind: "counter", label: "Home timeouts", min: 0, max: 5, value: (score) => score.home_timeouts, reduce: (score, input) => ({ ...score, home_timeouts: Number(input) }) },
    { id: "away_timeouts", kind: "counter", label: "Away timeouts", min: 0, max: 5, value: (score) => score.away_timeouts, reduce: (score, input) => ({ ...score, away_timeouts: Number(input) }) },
    { id: "home_bonus", kind: "toggle", label: "Home bonus", value: (score) => score.home_bonus, reduce: (score, input) => ({ ...score, home_bonus: Boolean(input) }) },
    { id: "away_bonus", kind: "toggle", label: "Away bonus", value: (score) => score.away_bonus, reduce: (score, input) => ({ ...score, away_bonus: Boolean(input) }) }
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
