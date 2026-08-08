import { z } from "zod";
import type { SportModule, SvgBinding } from "../types";

export const baseball_score_schema = z
  .object({
    home_team_name: z.string().min(1).default("home"),
    away_team_name: z.string().min(1).default("away"),
    home_score: z.coerce.number().int().nonnegative(),
    away_score: z.coerce.number().int().nonnegative(),
    inning_text: z.string().min(1),
    strikes_and_balls: z.string().min(1),
    out_text: z.string().min(1),
    base_one: z.boolean(),
    base_two: z.boolean(),
    base_three: z.boolean()
  })
  .strict();

export type BaseballScore = z.infer<typeof baseball_score_schema>;

export interface BaseballView {
  home_team_name: string;
  away_team_name: string;
  home_score: string;
  away_score: string;
  inning_text: string;
  count_text: string;
  out_text: string;
  base_one: boolean;
  base_two: boolean;
  base_three: boolean;
}

export function base_fill(occupied: boolean): string {
  return occupied ? "#ffea00" : "#ffffff";
}

const bindings: readonly SvgBinding<BaseballView>[] = [
  { operation: "text", selector: '[data-score-field="home_team_name"]', value: (view) => view.home_team_name },
  { operation: "text", selector: '[data-score-field="away_team_name"]', value: (view) => view.away_team_name },
  { operation: "text", selector: '[data-score-field="home_score"]', value: (view) => view.home_score },
  { operation: "text", selector: '[data-score-field="away_score"]', value: (view) => view.away_score },
  { operation: "text", selector: '[data-score-field="inning_text"]', value: (view) => view.inning_text },
  { operation: "text", selector: '[data-score-field="count_text"]', value: (view) => view.count_text },
  { operation: "text", selector: '[data-score-field="out_text"]', value: (view) => view.out_text },
  { operation: "attribute", selector: '[data-score-field="base_one"]', attribute: "fill", value: (view) => base_fill(view.base_one) },
  { operation: "attribute", selector: '[data-score-field="base_two"]', attribute: "fill", value: (view) => base_fill(view.base_two) },
  { operation: "attribute", selector: '[data-score-field="base_three"]', attribute: "fill", value: (view) => base_fill(view.base_three) }
];

export const baseball_module: SportModule<BaseballScore, BaseballView> = {
  id: "baseball",
  display_name: "Baseball",
  supported_sources: ["manual", "synced"],
  score_schema: baseball_score_schema,
  initial_score: baseball_score_schema.parse({
    home_score: 0,
    away_score: 0,
    inning_text: "top 1",
    strikes_and_balls: "0 - 0",
    out_text: "0 outs",
    base_one: false,
    base_two: false,
    base_three: false
  }),
  derive_view: (score) => ({
    home_team_name: score.home_team_name,
    away_team_name: score.away_team_name,
    home_score: String(score.home_score),
    away_score: String(score.away_score),
    inning_text: score.inning_text,
    count_text: score.strikes_and_balls,
    out_text: score.out_text,
    base_one: score.base_one,
    base_two: score.base_two,
    base_three: score.base_three
  }),
  bindings,
  controls: [
    { id: "home_score", kind: "counter", label: "Home score", shortcut: "h", min: 0, max: 99, value: (score) => score.home_score, reduce: (score, input) => ({ ...score, home_score: Number(input) }) },
    { id: "away_score", kind: "counter", label: "Away score", shortcut: "a", min: 0, max: 99, value: (score) => score.away_score, reduce: (score, input) => ({ ...score, away_score: Number(input) }) },
    { id: "balls", kind: "counter", label: "Balls", shortcut: "b", min: 0, max: 3, value: (score) => Number(score.strikes_and_balls.split(" - ")[0] ?? 0), reduce: (score, input) => ({ ...score, strikes_and_balls: `${Number(input)} - ${score.strikes_and_balls.split(" - ")[1] ?? "0"}` }) },
    { id: "strikes", kind: "counter", label: "Strikes", shortcut: "s", min: 0, max: 2, value: (score) => Number(score.strikes_and_balls.split(" - ")[1] ?? 0), reduce: (score, input) => ({ ...score, strikes_and_balls: `${score.strikes_and_balls.split(" - ")[0] ?? "0"} - ${Number(input)}` }) },
    { id: "outs", kind: "counter", label: "Outs", shortcut: "o", min: 0, max: 2, value: (score) => Number.parseInt(score.out_text, 10) || 0, reduce: (score, input) => ({ ...score, out_text: `${Number(input)} ${Number(input) === 1 ? "out" : "outs"}` }) },
    { id: "base_one", kind: "toggle", label: "First base", shortcut: "1", value: (score) => score.base_one, reduce: (score, input) => ({ ...score, base_one: Boolean(input) }) },
    { id: "base_two", kind: "toggle", label: "Second base", shortcut: "2", value: (score) => score.base_two, reduce: (score, input) => ({ ...score, base_two: Boolean(input) }) },
    { id: "base_three", kind: "toggle", label: "Third base", shortcut: "3", value: (score) => score.base_three, reduce: (score, input) => ({ ...score, base_three: Boolean(input) }) }
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
