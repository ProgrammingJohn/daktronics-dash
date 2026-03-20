import { useEffect, useRef, useState } from "react";

import { NumberField, ToggleButton } from "@/components/FormControls";
import type { ScoreboardState } from "@/state/types";

interface FootballControlsProps {
  state: ScoreboardState | null;
  disabled: boolean;
  onSubmit: (patch: Record<string, unknown>) => void;
}

interface FootballDraft {
  home_score: number;
  away_score: number;
  period: number;
  down: number;
  yards_to_go: number;
  home_timeouts: number;
  away_timeouts: number;
  home_possesion: boolean;
  minutes: number;
  seconds: number;
}

function toNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function fromState(state: ScoreboardState | null): FootballDraft {
  return {
    home_score: toNumber(state?.home_score, 0),
    away_score: toNumber(state?.away_score, 0),
    period: toNumber(state?.period, 1),
    down: toNumber(state?.down, 1),
    yards_to_go: toNumber(state?.yards_to_go ?? state?.yards, 10),
    home_timeouts: toNumber(state?.home_timeouts, 3),
    away_timeouts: toNumber(state?.away_timeouts, 3),
    home_possesion: Boolean(state?.home_possesion ?? true),
    minutes: toNumber((state?.clock as { minutes?: unknown } | undefined)?.minutes, 0),
    seconds: toNumber((state?.clock as { seconds?: unknown } | undefined)?.seconds, 0),
  };
}

function toPatch(draft: FootballDraft): Record<string, unknown> {
  const clampedSeconds = Math.min(Math.max(draft.seconds, 0), 59);
  const clampedMinutes = Math.min(Math.max(draft.minutes, 0), 99);

  return {
    home_score: Math.max(draft.home_score, 0),
    away_score: Math.max(draft.away_score, 0),
    period: Math.max(draft.period, 0),
    down: Math.min(Math.max(draft.down, 1), 4),
    yards_to_go: Math.max(draft.yards_to_go, 0),
    home_timeouts: Math.min(Math.max(draft.home_timeouts, 0), 3),
    away_timeouts: Math.min(Math.max(draft.away_timeouts, 0), 3),
    home_possesion: draft.home_possesion,
    clock: {
      minutes: String(clampedMinutes),
      seconds: String(clampedSeconds).padStart(2, "0"),
    },
    clock_text: `${clampedMinutes}:${String(clampedSeconds).padStart(2, "0")}`,
  };
}

export function FootballControls({ state, disabled, onSubmit }: FootballControlsProps): JSX.Element {
  const [draft, setDraft] = useState<FootballDraft>(() => fromState(state));
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    setDraft(fromState(state));
  }, [state]);

  useEffect(() => {
    if (disabled && intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [disabled]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (disabled) {
        return;
      }

      const key = event.key.toLowerCase();
      if (!["h", "a", "t", "y"].includes(key)) {
        return;
      }

      event.preventDefault();
      setDraft((prev) => {
        const next = { ...prev };
        if (key === "h") next.home_score += 1;
        if (key === "a") next.away_score += 1;
        if (key === "t") next.home_timeouts = Math.max(0, next.home_timeouts - 1);
        if (key === "y") next.away_timeouts = Math.max(0, next.away_timeouts - 1);
        onSubmit(toPatch(next));
        return next;
      });
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [disabled, onSubmit]);

  function update(patch: Partial<FootballDraft>, autoSubmit = false): void {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      if (autoSubmit) {
        onSubmit(toPatch(next));
      }
      return next;
    });
  }

  function submitCurrent(): void {
    onSubmit(toPatch(draft));
  }

  function startClock(): void {
    if (disabled || intervalRef.current !== null) {
      return;
    }

    intervalRef.current = window.setInterval(() => {
      setDraft((prev) => {
        const next = { ...prev };
        if (next.seconds === 0) {
          if (next.minutes === 0) {
            if (intervalRef.current !== null) {
              window.clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            return next;
          }
          next.minutes -= 1;
          next.seconds = 59;
        } else {
          next.seconds -= 1;
        }
        onSubmit(toPatch(next));
        return next;
      });
    }, 1000);
  }

  function stopClock(): void {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  return (
    <section className="panel">
      <h3>Manual Football Controls</h3>
      <p>Shortcuts: H home score, A away score, T home timeout, Y away timeout.</p>

      <div className="grid-two tight">
        <NumberField
          id="fb_home_score"
          label="Home Score"
          value={draft.home_score}
          onChange={(value) => update({ home_score: toNumber(value, 0) })}
          min={0}
          disabled={disabled}
        />
        <NumberField
          id="fb_away_score"
          label="Away Score"
          value={draft.away_score}
          onChange={(value) => update({ away_score: toNumber(value, 0) })}
          min={0}
          disabled={disabled}
        />
        <NumberField
          id="fb_period"
          label="Period"
          value={draft.period}
          onChange={(value) => update({ period: toNumber(value, 1) })}
          min={0}
          disabled={disabled}
        />
        <NumberField
          id="fb_down"
          label="Down"
          value={draft.down}
          onChange={(value) => update({ down: toNumber(value, 1) })}
          min={1}
          max={4}
          disabled={disabled}
        />
        <NumberField
          id="fb_yards_to_go"
          label="Yards to Go"
          value={draft.yards_to_go}
          onChange={(value) => update({ yards_to_go: toNumber(value, 10) })}
          min={0}
          disabled={disabled}
        />
        <ToggleButton
          label={`Possession: ${draft.home_possesion ? "Home" : "Away"}`}
          active={draft.home_possesion}
          onClick={() => update({ home_possesion: !draft.home_possesion })}
          disabled={disabled}
        />
        <NumberField
          id="fb_home_timeouts"
          label="Home Timeouts"
          value={draft.home_timeouts}
          onChange={(value) => update({ home_timeouts: toNumber(value, 3) })}
          min={0}
          max={3}
          disabled={disabled}
        />
        <NumberField
          id="fb_away_timeouts"
          label="Away Timeouts"
          value={draft.away_timeouts}
          onChange={(value) => update({ away_timeouts: toNumber(value, 3) })}
          min={0}
          max={3}
          disabled={disabled}
        />
        <NumberField
          id="fb_clock_min"
          label="Clock Minutes"
          value={draft.minutes}
          onChange={(value) => update({ minutes: toNumber(value, 0) })}
          min={0}
          max={99}
          disabled={disabled}
        />
        <NumberField
          id="fb_clock_sec"
          label="Clock Seconds"
          value={draft.seconds}
          onChange={(value) => update({ seconds: toNumber(value, 0) })}
          min={0}
          max={59}
          disabled={disabled}
        />
      </div>

      <div className="button-row">
        <button type="button" className="button button-ghost" onClick={startClock} disabled={disabled}>
          Start Clock
        </button>
        <button type="button" className="button button-ghost" onClick={stopClock} disabled={disabled}>
          Stop Clock
        </button>
        <button type="button" className="button" onClick={submitCurrent} disabled={disabled}>
          Apply Update
        </button>
      </div>
    </section>
  );
}
