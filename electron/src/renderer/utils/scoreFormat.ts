import type { ScoreboardState, Sport } from "@/state/types";

export function formatPeriod(period: number | string | undefined, sport: Sport): string {
  const numeric = Number(period);
  if (!Number.isFinite(numeric)) {
    return String(period ?? "");
  }

  if (sport === "baseball") {
    return String(numeric);
  }

  if (numeric <= 0) return "pre";
  if (numeric === 1) return "1st";
  if (numeric === 2) return "2nd";
  if (numeric === 3) return "3rd";
  if (numeric === 4) return "4th";
  return `ot${numeric - 4}`;
}

export function formatClockText(state: ScoreboardState): string {
  if (typeof state.clock_text === "string" && state.clock_text.trim()) {
    return state.clock_text;
  }

  if (state.clock && typeof state.clock === "object") {
    const minutes = String((state.clock as { minutes?: string | number }).minutes ?? "0");
    const seconds = String((state.clock as { seconds?: string | number }).seconds ?? "00").padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  return "0:00";
}

export function formatDownText(state: ScoreboardState): string {
  const down = Number(state.down ?? 0);
  const yards = Number(state.yards_to_go ?? 0);
  const downMap: Record<number, string> = {
    1: "1st",
    2: "2nd",
    3: "3rd",
    4: "4th",
  };

  if (!downMap[down]) return "";
  return `${downMap[down]} & ${yards}`;
}

export function buildRenderValues(state: ScoreboardState, sport: Sport): Record<string, unknown> {
  return {
    ...state,
    clock_text: formatClockText(state),
    period: formatPeriod(state.period as number | string | undefined, sport),
    down_text: formatDownText(state),
  };
}

export function buildSampleValues(sport: Sport): Record<string, unknown> {
  if (sport === "baseball") {
    return {
      home_team_name: "HOME",
      away_team_name: "AWAY",
      home_score: 5,
      away_score: 2,
      inning_text: "top 7",
      strikes_and_balls: "2 - 1",
      out_text: "1 outs",
      base_one: true,
      base_two: false,
      base_three: true,
    };
  }

  if (sport === "basketball") {
    return {
      home_team_name: "HOME",
      away_team_name: "AWAY",
      home_score: 72,
      away_score: 68,
      home_fouls: 4,
      away_fouls: 5,
      clock_text: "1:24",
      period: "4th",
      home_timeouts: 3,
      away_timeouts: 2,
      home_bonus: false,
      away_bonus: true,
    };
  }

  return {
    home_team_name: "HOME",
    away_team_name: "AWAY",
    home_score: 21,
    away_score: 17,
    clock_text: "04:12",
    period: "3rd",
    down_text: "2nd & 6",
    home_timeouts: 2,
    away_timeouts: 1,
    home_possesion: true,
  };
}
