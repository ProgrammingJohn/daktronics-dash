import { useEffect, useRef, useState } from "react";

import { NumberField, ToggleButton } from "@/components/FormControls";
import type { ScoreboardState } from "@/state/types";

interface BasketballControlsProps {
  state: ScoreboardState | null;
  disabled: boolean;
  onSubmit: (patch: Record<string, unknown>) => void;
}

interface BasketballDraft {
  home_score: number;
  away_score: number;
  period: number;
  home_fouls: number;
  away_fouls: number;
  home_bonus: boolean;
  away_bonus: boolean;
  home_timeouts: number;
  away_timeouts: number;
  minutes: number;
  seconds: number;
}

function toNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function fromState(state: ScoreboardState | null): BasketballDraft {
  return {
    home_score: toNumber(state?.home_score, 0),
    away_score: toNumber(state?.away_score, 0),
    period: toNumber(state?.period, 1),
    home_fouls: toNumber(state?.home_fouls, 0),
    away_fouls: toNumber(state?.away_fouls, 0),
    home_bonus: Boolean(state?.home_bonus ?? false),
    away_bonus: Boolean(state?.away_bonus ?? false),
    home_timeouts: toNumber(state?.home_timeouts, 5),
    away_timeouts: toNumber(state?.away_timeouts, 5),
    minutes: toNumber((state?.clock as { minutes?: unknown } | undefined)?.minutes, 0),
    seconds: toNumber((state?.clock as { seconds?: unknown } | undefined)?.seconds, 0),
  };
}

function toPatch(draft: BasketballDraft): Record<string, unknown> {
  const clampedSeconds = Math.min(Math.max(draft.seconds, 0), 59);
  const clampedMinutes = Math.min(Math.max(draft.minutes, 0), 99);

  return {
    home_score: Math.max(draft.home_score, 0),
    away_score: Math.max(draft.away_score, 0),
    period: Math.max(draft.period, 0),
    home_fouls: Math.max(draft.home_fouls, 0),
    away_fouls: Math.max(draft.away_fouls, 0),
    home_bonus: draft.home_bonus,
    away_bonus: draft.away_bonus,
    home_timeouts: Math.min(Math.max(draft.home_timeouts, 0), 5),
    away_timeouts: Math.min(Math.max(draft.away_timeouts, 0), 5),
    clock: {
      minutes: String(clampedMinutes),
      seconds: String(clampedSeconds).padStart(2, "0"),
    },
    clock_text: `${clampedMinutes}:${String(clampedSeconds).padStart(2, "0")}`,
  };
}

export function BasketballControls({ state, disabled, onSubmit }: BasketballControlsProps): JSX.Element {
  const [draft, setDraft] = useState<BasketballDraft>(() => fromState(state));
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
      if (!["h", "a", "p", "f", "g", "t", "y", "[", "]"].includes(key)) {
        return;
      }

      if (key === "[") {
        event.preventDefault();
        startClock();
        return;
      }

      if (key === "]") {
        event.preventDefault();
        stopClock();
        return;
      }

      event.preventDefault();
      setDraft((prev) => {
        const next = { ...prev };
        if (key === "h") next.home_score += 1;
        if (key === "a") next.away_score += 1;
        if (key === "p") next.period += 1;
        if (key === "f") {
          next.home_fouls += 1;
          next.away_bonus = next.home_fouls >= 5;
        }
        if (key === "g") {
          next.away_fouls += 1;
          next.home_bonus = next.away_fouls >= 5;
        }
        if (key === "t") next.home_timeouts = Math.max(0, next.home_timeouts - 1);
        if (key === "y") next.away_timeouts = Math.max(0, next.away_timeouts - 1);
        onSubmit(toPatch(next));
        return next;
      });
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [disabled, onSubmit]);

  function update(patch: Partial<BasketballDraft>): void {
    setDraft((prev) => ({ ...prev, ...patch }));
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
      <h3>Manual Basketball Controls</h3>
      <p>Shortcuts: H/A score, P period, F/G fouls, T/Y timeouts, [ start clock, ] stop clock.</p>

      <div className="grid-two tight">
        <NumberField
          id="bb_home_score"
          label="Home Score"
          value={draft.home_score}
          onChange={(value) => update({ home_score: toNumber(value, 0) })}
          min={0}
          disabled={disabled}
        />
        <NumberField
          id="bb_away_score"
          label="Away Score"
          value={draft.away_score}
          onChange={(value) => update({ away_score: toNumber(value, 0) })}
          min={0}
          disabled={disabled}
        />
        <NumberField
          id="bb_period"
          label="Period"
          value={draft.period}
          onChange={(value) => update({ period: toNumber(value, 1) })}
          min={0}
          disabled={disabled}
        />
        <NumberField
          id="bb_home_fouls"
          label="Home Fouls"
          value={draft.home_fouls}
          onChange={(value) => {
            const next = toNumber(value, 0);
            update({ home_fouls: next, away_bonus: next >= 5 });
          }}
          min={0}
          disabled={disabled}
        />
        <NumberField
          id="bb_away_fouls"
          label="Away Fouls"
          value={draft.away_fouls}
          onChange={(value) => {
            const next = toNumber(value, 0);
            update({ away_fouls: next, home_bonus: next >= 5 });
          }}
          min={0}
          disabled={disabled}
        />
        <ToggleButton
          label={`Home Bonus: ${draft.home_bonus ? "ON" : "OFF"}`}
          active={draft.home_bonus}
          onClick={() => update({ home_bonus: !draft.home_bonus })}
          disabled={disabled}
        />
        <ToggleButton
          label={`Away Bonus: ${draft.away_bonus ? "ON" : "OFF"}`}
          active={draft.away_bonus}
          onClick={() => update({ away_bonus: !draft.away_bonus })}
          disabled={disabled}
        />
        <NumberField
          id="bb_home_timeouts"
          label="Home Timeouts"
          value={draft.home_timeouts}
          onChange={(value) => update({ home_timeouts: toNumber(value, 5) })}
          min={0}
          max={5}
          disabled={disabled}
        />
        <NumberField
          id="bb_away_timeouts"
          label="Away Timeouts"
          value={draft.away_timeouts}
          onChange={(value) => update({ away_timeouts: toNumber(value, 5) })}
          min={0}
          max={5}
          disabled={disabled}
        />
        <NumberField
          id="bb_clock_min"
          label="Clock Minutes"
          value={draft.minutes}
          onChange={(value) => update({ minutes: toNumber(value, 0) })}
          min={0}
          max={99}
          disabled={disabled}
        />
        <NumberField
          id="bb_clock_sec"
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
