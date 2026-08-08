import { useEffect, useState } from "react";
import type { AppearancePayload } from "../../domain/session";
import { select_display_snapshot } from "../../state/session_reducer";
import { use_session } from "../../state/SessionProvider";
import { get_sport } from "../../sports/registry";
import { ManualControlDeck } from "../manual/ManualControlDeck";
import { AppearanceEditor } from "../appearance/AppearanceEditor";
import { ConnectionBadge } from "./ConnectionBadge";
import { ProgramPreview } from "./ProgramPreview";
import styles from "./OperatorConsole.module.css";

export function OperatorConsole() {
  const session = use_session();
  const [appearance_open, set_appearance_open] = useState(false);
  const [appearance, set_appearance] = useState<AppearancePayload | undefined>();
  const snapshot = select_display_snapshot(session.state);
  const active_sport = snapshot?.session.sport;

  useEffect(() => {
    let active = true;
    if (active_sport === undefined) return;
    set_appearance(undefined);
    void session.load_appearance(active_sport).then((payload) => {
      if (active) set_appearance(payload);
    });
    return () => {
      active = false;
    };
  }, [active_sport, session.load_appearance]);

  if (snapshot === null) return null;

  const sport = get_sport(snapshot.session.sport);
  const synced = snapshot.session.source === "synced";
  const daktronics_authority = snapshot.session.control_authority === "daktronics";
  const source_label = synced ? "Daktronics Sync" : "Manual Control";
  const age = snapshot.connection.source_age_ms;

  const take_over = (): void => {
    if (window.confirm("Take manual control? The last live score will be copied into manual controls.")) {
      void session.take_manual_control();
    }
  };

  const launch_new = (): void => {
    if (window.confirm("End this session and return to sport selection?")) {
      void session.launch_new_session();
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.identity}>
          <span className={styles.brandMark}>DD</span>
          <div>
            <p>Current session</p>
            <h1>{sport.display_name}</h1>
          </div>
        </div>
        <div className={styles.sessionMeta}>
          <span>{source_label}</span>
          <ConnectionBadge status={snapshot.connection.status} />
        </div>
      </header>

      <div className={styles.layout}>
        <div className={styles.primary}>
          <ProgramPreview snapshot={snapshot} appearance={appearance} />
          <section className={styles.metrics} aria-label="Connection summary">
            <div><span>Connection state</span><strong>{snapshot.connection.backend_status}</strong></div>
            <div><span>Transport</span><strong>{snapshot.connection.transport ?? "—"}</strong></div>
            <div><span>Source age</span><strong>{age === null ? "—" : `${age} ms`}</strong></div>
            <div><span>Revision</span><strong>{snapshot.scoreboard.revision}</strong></div>
          </section>
        </div>

        <aside className={styles.sidebar}>
          <section className={styles.panel}>
            <span className={styles.sectionLabel}>Control authority</span>
            <h2>{daktronics_authority ? "Monitoring Daktronics" : "Manual control active"}</h2>
            <p>
              {daktronics_authority
                ? "The console is monitoring the controller. The live feed remains authoritative."
                : "Operator changes are authoritative for this session."}
            </p>
            {synced && daktronics_authority && (
              <button className={styles.primaryButton} onClick={take_over}>
                Take manual control…
              </button>
            )}
            {!daktronics_authority && <ManualControlDeck />}
          </section>

          <details className={styles.details}>
            <summary>Connection details</summary>
            <dl>
              <div><dt>Session</dt><dd>{snapshot.session.session_id}</dd></div>
              <div><dt>Last update</dt><dd>{snapshot.connection.last_update_at ?? "Never"}</dd></div>
              <div><dt>Message</dt><dd>{snapshot.connection.message ?? "No issues"}</dd></div>
              <div><dt>Source</dt><dd>{snapshot.connection.source ?? "—"}</dd></div>
            </dl>
          </details>

          <button className={styles.secondaryButton} onClick={() => set_appearance_open(true)}>Team titles and colors</button>
          <button className={styles.dangerButton} onClick={launch_new}>Launch new session…</button>
        </aside>
      </div>
      {appearance_open && (
        <AppearanceEditor
          snapshot={snapshot}
          on_close={() => set_appearance_open(false)}
          on_apply={set_appearance}
        />
      )}
    </main>
  );
}
