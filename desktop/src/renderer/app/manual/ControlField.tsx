import { useEffect, useState } from "react";
import type { ControlDefinition, ControlInput } from "../../sports/types";
import styles from "./ManualControlDeck.module.css";

interface ControlFieldProps<TScore> {
  control: ControlDefinition<TScore>;
  score: TScore;
  on_change(input: ControlInput): void;
}

function clamp(value: number, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY): number {
  return Math.min(max, Math.max(min, value));
}

export function ControlField<TScore>({ control, score, on_change }: ControlFieldProps<TScore>) {
  const value = control.value(score);
  const clock_value =
    typeof value === "object" ? value : { minutes: 0, seconds: 0 };
  const [minutes, set_minutes] = useState(clock_value.minutes);
  const [seconds, set_seconds] = useState(clock_value.seconds);

  useEffect(() => {
    if (control.kind === "clock" && typeof value === "object") {
      set_minutes(value.minutes);
      set_seconds(value.seconds);
    }
  }, [control.kind, value]);

  if (control.kind === "counter") {
    const numeric = Number(value);
    return (
      <div className={styles.controlField}>
        <span className={styles.controlLabel}>{control.label}</span>
        <div className={styles.counter}>
          <button aria-label={`${control.label} decrease`} onClick={() => on_change(clamp(numeric - 1, control.min, control.max))}>−</button>
          <output aria-label={`${control.label} value`}>{numeric}</output>
          <button aria-label={`${control.label} increase`} onClick={() => on_change(clamp(numeric + 1, control.min, control.max))}>+</button>
        </div>
      </div>
    );
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
    return (
      <div className={styles.clockField}>
        <span className={styles.controlLabel}>{control.label}</span>
        <div className={styles.clockInputs}>
          <label>Min<input aria-label={`${control.label} minutes`} type="number" min="0" max="99" value={minutes} onChange={(event) => set_minutes(clamp(Number(event.target.value), 0, 99))} /></label>
          <span>:</span>
          <label>Sec<input aria-label={`${control.label} seconds`} type="number" min="0" max="59" value={seconds} onChange={(event) => set_seconds(clamp(Number(event.target.value), 0, 59))} /></label>
          <button onClick={() => on_change({ minutes, seconds })}>Set clock</button>
        </div>
      </div>
    );
  }

  return <button className={styles.action} onClick={() => on_change(value)}>{control.label}</button>;
}
