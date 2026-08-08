import { useEffect, useState } from "react";
import type { ControlDefinition, ControlInput } from "../../sports/types";
import styles from "./ManualControlDeck.module.css";
import { use_game_clock } from "./use_game_clock";

interface ControlFieldProps<TScore> {
  control: ControlDefinition<TScore>;
  score: TScore;
  on_change(input: ControlInput): Promise<void> | void;
}

function clamp(value: number, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY): number {
  return Math.min(max, Math.max(min, value));
}

export function ControlField<TScore>({ control, score, on_change }: ControlFieldProps<TScore>) {
  const value = control.value(score);

  if (control.kind === "counter") {
    return <CounterControl control={control} value={Number(value)} on_change={on_change} />;
  }

  if (control.kind === "toggle") {
    return (
      <button className={styles.toggle} aria-pressed={Boolean(value)} onClick={() => on_change(!Boolean(value))}>
        <span>{control.label}</span>
        <strong>{Boolean(value) ? "On" : "Off"}</strong>
      </button>
    );
  }

  if (control.kind === "choice") {
    return (
      <label className={styles.controlField}>
        <span className={styles.controlLabel}>{control.label}</span>
        <select value={String(value)} onChange={(event) => on_change(event.target.value)}>
          {control.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
    );
  }

  if (control.kind === "clock") {
    const clock = typeof value === "object" ? value : { minutes: 0, seconds: 0 };
    return <ClockControl label={control.label} clock={clock} on_change={on_change} />;
  }

  return <button className={styles.action} onClick={() => on_change(value)}>{control.label}</button>;
}

function CounterControl<TScore>({
  control,
  value,
  on_change
}: {
  control: ControlDefinition<TScore>;
  value: number;
  on_change(input: ControlInput): Promise<void> | void;
}) {
  const [draft, set_draft] = useState(String(value));
  const [editing, set_editing] = useState(false);

  useEffect(() => {
    if (!editing) set_draft(String(value));
  }, [editing, value]);

  const normalized_draft = (): number | null => {
    if (draft.trim() === "") return null;
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) return null;
    return clamp(Math.trunc(parsed), control.min, control.max);
  };

  const commit = () => {
    const next = normalized_draft();
    if (next === null) {
      set_draft(String(value));
      return;
    }
    set_draft(String(next));
    if (next !== value) void on_change(next);
  };

  const adjust = (delta: number) => {
    const base = normalized_draft() ?? value;
    const next = clamp(base + delta, control.min, control.max);
    set_draft(String(next));
    void on_change(next);
  };

  return (
    <div className={styles.controlField}>
      <span className={styles.controlLabel}>{control.label}</span>
      <div className={styles.counter}>
        <button
          type="button"
          aria-label={`${control.label} decrease`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => adjust(-1)}
        >
          −
        </button>
        <input
          aria-label={`${control.label} value`}
          type="number"
          inputMode="numeric"
          step="1"
          min={control.min}
          max={control.max}
          value={draft}
          onFocus={() => set_editing(true)}
          onChange={(event) => set_draft(event.target.value)}
          onBlur={() => {
            commit();
            set_editing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            } else if (event.key === "Escape") {
              event.preventDefault();
              set_draft(String(value));
            }
          }}
        />
        <button
          type="button"
          aria-label={`${control.label} increase`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => adjust(1)}
        >
          +
        </button>
      </div>
    </div>
  );
}

function ClockControl({
  label,
  clock,
  on_change
}: {
  label: string;
  clock: { minutes: number; seconds: number };
  on_change(input: ControlInput): Promise<void> | void;
}) {
  const [minutes, set_minutes] = useState(clock.minutes);
  const [seconds, set_seconds] = useState(clock.seconds);
  const game_clock = use_game_clock({ clock, on_tick: on_change });

  useEffect(() => {
    set_minutes(clock.minutes);
    set_seconds(clock.seconds);
  }, [clock.minutes, clock.seconds]);

  return (
    <div className={styles.clockField}>
      <span className={styles.controlLabel}>{label}</span>
      <div className={styles.clockInputs}>
        <label>Min<input aria-label={`${label} minutes`} type="number" min="0" max="99" value={minutes} onChange={(event) => set_minutes(clamp(Number(event.target.value), 0, 99))} /></label>
        <span>:</span>
        <label>Sec<input aria-label={`${label} seconds`} type="number" min="0" max="59" value={seconds} onChange={(event) => set_seconds(clamp(Number(event.target.value), 0, 59))} /></label>
        <button onClick={() => on_change({ minutes, seconds })}>Set clock</button>
        <button onClick={game_clock.running ? game_clock.stop : game_clock.start}>
          {game_clock.running ? "Stop clock" : "Start clock"}
        </button>
      </div>
    </div>
  );
}
