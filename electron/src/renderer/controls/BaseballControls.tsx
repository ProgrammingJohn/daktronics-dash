import { useEffect, useState } from "react";

import { NumberField, SelectField, ToggleButton } from "@/components/FormControls";
import type { ScoreboardState } from "@/state/types";

interface BaseballControlsProps {
  state: ScoreboardState | null;
  disabled: boolean;
  onSubmit: (patch: Record<string, unknown>) => void;
}

interface BaseballDraft {
  home_score: number;
  away_score: number;
  inning: number;
  inning_half: "top" | "bot";
  outs: number;
  strikes: number;
  balls: number;
  base_one: boolean;
  base_two: boolean;
  base_three: boolean;
}

function toNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function fromState(state: ScoreboardState | null): BaseballDraft {
  const inningHalf = state?.inning_half === "bot" ? "bot" : "top";
  return {
    home_score: toNumber(state?.home_score, 0),
    away_score: toNumber(state?.away_score, 0),
    inning: toNumber(state?.inning ?? state?.innings, 1),
    inning_half: inningHalf,
    outs: toNumber(state?.outs, 0),
    strikes: toNumber(state?.strikes, 0),
    balls: toNumber(state?.balls, 0),
    base_one: Boolean(state?.base_one ?? false),
    base_two: Boolean(state?.base_two ?? false),
    base_three: Boolean(state?.base_three ?? false),
  };
}

function normalize(draft: BaseballDraft): BaseballDraft {
  const next: BaseballDraft = {
    ...draft,
    home_score: Math.max(draft.home_score, 0),
    away_score: Math.max(draft.away_score, 0),
    inning: Math.max(draft.inning, 1),
    outs: Math.max(draft.outs, 0),
    strikes: Math.max(draft.strikes, 0),
    balls: Math.max(draft.balls, 0),
  };

  if (next.strikes > 2) {
    next.strikes = 0;
    next.balls = 0;
    next.outs += 1;
  }

  if (next.balls > 3) {
    next.balls = 0;
    next.strikes = 0;
  }

  if (next.outs > 2) {
    next.outs = 0;
    if (next.inning_half === "bot") {
      next.inning += 1;
      next.inning_half = "top";
    } else {
      next.inning_half = "bot";
    }
  }

  return next;
}

function toPatch(draft: BaseballDraft): Record<string, unknown> {
  const normalized = normalize(draft);
  return {
    home_score: normalized.home_score,
    away_score: normalized.away_score,
    inning: normalized.inning,
    inning_half: normalized.inning_half,
    outs: normalized.outs,
    strikes: normalized.strikes,
    balls: normalized.balls,
    base_one: normalized.base_one,
    base_two: normalized.base_two,
    base_three: normalized.base_three,
  };
}

export function BaseballControls({ state, disabled, onSubmit }: BaseballControlsProps): JSX.Element {
  const [draft, setDraft] = useState<BaseballDraft>(() => fromState(state));

  useEffect(() => {
    setDraft(fromState(state));
  }, [state]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (disabled) {
        return;
      }

      const key = event.key.toLowerCase();
      if (!["h", "a", "i", "o", "s", "b", "t", "1", "2", "3"].includes(key)) {
        return;
      }

      event.preventDefault();
      setDraft((prev) => {
        const next = { ...prev };
        if (key === "h") next.home_score += 1;
        if (key === "a") next.away_score += 1;
        if (key === "i") next.inning += 1;
        if (key === "o") next.outs += 1;
        if (key === "s") next.strikes += 1;
        if (key === "b") next.balls += 1;
        if (key === "t") next.inning_half = next.inning_half === "top" ? "bot" : "top";
        if (key === "1") next.base_one = !next.base_one;
        if (key === "2") next.base_two = !next.base_two;
        if (key === "3") next.base_three = !next.base_three;

        const normalized = normalize(next);
        onSubmit(toPatch(normalized));
        return normalized;
      });
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [disabled, onSubmit]);

  function update(patch: Partial<BaseballDraft>): void {
    setDraft((prev) => normalize({ ...prev, ...patch }));
  }

  function submitCurrent(): void {
    onSubmit(toPatch(draft));
  }

  return (
    <section className="panel">
      <h3>Manual Baseball Controls</h3>
      <p>Shortcuts: H/A score, I inning, O outs, S strikes, B balls, T half, 1/2/3 bases.</p>

      <div className="grid-two tight">
        <NumberField
          id="bs_home_score"
          label="Home Score"
          value={draft.home_score}
          onChange={(value) => update({ home_score: toNumber(value, 0) })}
          min={0}
          disabled={disabled}
        />
        <NumberField
          id="bs_away_score"
          label="Away Score"
          value={draft.away_score}
          onChange={(value) => update({ away_score: toNumber(value, 0) })}
          min={0}
          disabled={disabled}
        />
        <NumberField
          id="bs_inning"
          label="Inning"
          value={draft.inning}
          onChange={(value) => update({ inning: toNumber(value, 1) })}
          min={1}
          disabled={disabled}
        />
        <SelectField
          id="bs_inning_half"
          label="Half"
          value={draft.inning_half}
          options={[
            { value: "top", label: "Top" },
            { value: "bot", label: "Bottom" },
          ]}
          onChange={(value) => update({ inning_half: value === "bot" ? "bot" : "top" })}
          disabled={disabled}
        />
        <NumberField
          id="bs_outs"
          label="Outs"
          value={draft.outs}
          onChange={(value) => update({ outs: toNumber(value, 0) })}
          min={0}
          max={2}
          disabled={disabled}
        />
        <NumberField
          id="bs_strikes"
          label="Strikes"
          value={draft.strikes}
          onChange={(value) => update({ strikes: toNumber(value, 0) })}
          min={0}
          max={2}
          disabled={disabled}
        />
        <NumberField
          id="bs_balls"
          label="Balls"
          value={draft.balls}
          onChange={(value) => update({ balls: toNumber(value, 0) })}
          min={0}
          max={3}
          disabled={disabled}
        />
      </div>

      <div className="button-row">
        <ToggleButton
          label={`1B ${draft.base_one ? "ON" : "OFF"}`}
          active={draft.base_one}
          onClick={() => update({ base_one: !draft.base_one })}
          disabled={disabled}
        />
        <ToggleButton
          label={`2B ${draft.base_two ? "ON" : "OFF"}`}
          active={draft.base_two}
          onClick={() => update({ base_two: !draft.base_two })}
          disabled={disabled}
        />
        <ToggleButton
          label={`3B ${draft.base_three ? "ON" : "OFF"}`}
          active={draft.base_three}
          onClick={() => update({ base_three: !draft.base_three })}
          disabled={disabled}
        />
        <button type="button" className="button" onClick={submitCurrent} disabled={disabled}>
          Apply Update
        </button>
      </div>
    </section>
  );
}
