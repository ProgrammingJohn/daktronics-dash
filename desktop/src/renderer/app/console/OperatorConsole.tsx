import { select_display_snapshot } from "../../state/session_reducer";
import { use_session } from "../../state/SessionProvider";
import { get_sport } from "../../sports/registry";
import { ConnectionBadge } from "./ConnectionBadge";
import { ProgramPreview } from "./ProgramPreview";
import styles from "./OperatorConsole.module.css";

export function OperatorConsole() {
  const session = use_session();
  const snapshot = select_display_snapshot(session.state);
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
          <ProgramPreview snapshot={snapshot} />
          <section className={styles.metrics} aria-label="Connection summary">
            <div><span>Source age</span><strong>{age === null ? "—" : `${age} ms`}</strong></div>
            <div><span>Revision</span><strong>{snapshot.scoreboard.revision}</strong></div>
            <div><span>Backend</span><strong>{snapshot.connection.backend_status}</strong></div>
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
            {!daktronics_authority && <div className={styles.manualPlaceholder}>Manual controls</div>}
          </section>

          <details className={styles.details}>
            <summary>Connection details</summary>
            <dl>
              <div><dt>Session</dt><dd>{snapshot.session.session_id}</dd></div>
              <div><dt>Last update</dt><dd>{snapshot.connection.last_update_at ?? "Never"}</dd></div>
              <div><dt>Message</dt><dd>{snapshot.connection.message ?? "No issues"}</dd></div>
            </dl>
          </details>

          <button className={styles.secondaryButton}>Appearance settings</button>
          <button className={styles.dangerButton} onClick={launch_new}>Launch new session…</button>
        </aside>
      </div>
    </main>
  );
}
