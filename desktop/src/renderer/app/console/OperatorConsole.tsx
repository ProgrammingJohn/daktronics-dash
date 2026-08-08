import { useEffect, useState } from "react";
import type { AppearancePayload } from "../../domain/session";
import { select_display_snapshot } from "../../state/session_reducer";
import { use_session } from "../../state/SessionProvider";
import { get_sport } from "../../sports/registry";
import { ManualControlDeck } from "../manual/ManualControlDeck";
import { AppearanceEditor } from "../appearance/AppearanceEditor";
import { save_connection_method } from "../launch/connection_preferences";
import { ConnectionBadge } from "./ConnectionBadge";
import { ProgramPreview } from "./ProgramPreview";
import styles from "./OperatorConsole.module.css";

export function OperatorConsole() {
  const session = use_session();
  const [appearance_open, set_appearance_open] = useState(false);
  const [appearance, set_appearance] = useState<AppearancePayload | undefined>();
  const [retrying, set_retrying] = useState(false);
  const [discovery_error, set_discovery_error] = useState<string | null>(null);
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
  const discovery = snapshot.connection.discovery;
  const show_full_discovery =
    synced &&
    discovery !== undefined &&
    discovery.phase !== "IDLE" &&
    discovery.phase !== "FOUND";

  const discovery_message = (() => {
    if (discovery === undefined) return null;
    if (discovery.phase === "DIRECT_CONNECT") return "Connecting to the saved device…";
    if (discovery.phase === "PASSIVE_LOOKUP") return "Checking for the device locally…";
    if (discovery.phase === "BROADCAST_PROBING") {
      return `Searching the local network… attempt ${discovery.attempts} of 3.`;
    }
    if (discovery.phase === "FOUND") {
      return `Device found at ${discovery.resolved_host ?? "the resolved address"}.`;
    }
    return null;
  })();

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

  const retry_discovery = (): void => {
    if (retrying) return;
    set_retrying(true);
    set_discovery_error(null);
    void session.retry_sync()
      .catch((reason: unknown) => {
        set_discovery_error(reason instanceof Error ? reason.message : "Unable to retry discovery");
      })
      .finally(() => set_retrying(false));
  };

  const enter_ip_manually = (): void => {
    try {
      save_connection_method(window.localStorage, "direct");
    } catch {
      // The launcher can still open if local storage is unavailable.
    }
    void session.launch_new_session();
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
          {synced && discovery?.phase === "FOUND" && (
            <section className={`${styles.panel} ${styles.resolvedDevice}`} aria-label="Connected device">
              <span>Device IP</span>
              <strong>{discovery.resolved_host ?? "—"}</strong>
            </section>
          )}
          {show_full_discovery && (
            <section className={styles.panel} aria-label="Device discovery">
              <span className={styles.sectionLabel}>Device discovery</span>
              <h2>{discovery.phase === "NOT_FOUND" ? "Device not found" : "Finding scoreboard"}</h2>
              {discovery_message !== null && <p>{discovery_message}</p>}
              <dl className={styles.discoveryDetails}>
                <div><dt>Phase</dt><dd>{discovery.phase}</dd></div>
                <div><dt>Attempts</dt><dd>{discovery.attempts}</dd></div>
                <div><dt>Method</dt><dd>{discovery.method ?? "—"}</dd></div>
                <div><dt>Resolved host</dt><dd>{discovery.resolved_host ?? "—"}</dd></div>
              </dl>
              {discovery.phase !== "FOUND" && discovery.phase !== "DIRECT_CONNECT" && (
                <div className={styles.discoveryActions}>
                  {discovery.phase === "NOT_FOUND" && (
                    <button className={styles.primaryButton} disabled={retrying} onClick={retry_discovery}>
                      {retrying ? "Retrying…" : "Retry discovery"}
                    </button>
                  )}
                  <button className={styles.secondaryButton} onClick={enter_ip_manually}>
                    Enter IP manually
                  </button>
                </div>
              )}
              {discovery_error !== null && <p className={styles.inlineError}>{discovery_error}</p>}
            </section>
          )}
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
