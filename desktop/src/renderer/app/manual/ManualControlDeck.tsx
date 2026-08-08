import { useMemo, useState } from "react";
import { use_session } from "../../state/SessionProvider";
import { get_sport } from "../../sports/registry";
import type { ControlDefinition, ControlInput } from "../../sports/types";
import { ControlField } from "./ControlField";
import { use_sport_shortcuts } from "./use_sport_shortcuts";
import styles from "./ManualControlDeck.module.css";

export function ManualControlDeck() {
  const session = use_session();
  const snapshot = session.state.optimistic ?? session.state.accepted;
  const [error, set_error] = useState<string | null>(null);
  if (snapshot === null) return null;
  const sport = get_sport(snapshot.session.sport);
  const score = sport.score_schema.parse(snapshot.scoreboard.fields);

  const apply = (control: ControlDefinition<any>, input: ControlInput): void => {
    set_error(null);
    const next = sport.score_schema.parse(control.reduce(score, input));
    void session.transition(next).catch((reason: unknown) => {
      set_error(reason instanceof Error ? reason.message : "Manual update failed");
    });
  };

  const shortcuts = useMemo(() => {
    const entries = sport.controls.flatMap((control: ControlDefinition<any>) => {
      if (control.shortcut === undefined) return [];
      return [[control.shortcut, () => {
        const current = control.value(score);
        if (control.kind === "counter") apply(control, Number(current) + (control.shortcut_delta ?? 1));
        else if (control.kind === "toggle") apply(control, !Boolean(current));
        else apply(control, current);
      }] as const];
    });
    return Object.fromEntries(entries) as Record<string, () => void>;
  }, [score, sport]);
  use_sport_shortcuts(shortcuts);

  return (
    <section className={styles.deck}>
      <div className={styles.deckHeader}>
        <div><span>Operator authority</span><h2>Manual controls</h2></div>
        <button disabled={session.state.undo_stack.length === 0} onClick={() => void session.undo()}>Undo</button>
      </div>
      <div className={styles.controls}>
        {sport.controls.map((control: ControlDefinition<any>) => (
          <ControlField key={control.id} control={control} score={score} on_change={(input) => apply(control, input)} />
        ))}
      </div>
      {snapshot.session.source === "synced" && (
        <button
          className={styles.returnButton}
          onClick={() => {
            if (window.confirm("Return authority to the live Daktronics feed?")) void session.return_to_sync();
          }}
        >
          Return to Daktronics sync…
        </button>
      )}
      {error && <p className={styles.error}>{error}</p>}
    </section>
  );
}
