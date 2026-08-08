import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { SportId, TransmissionSource } from "../../domain/session";
import { use_session } from "../../state/SessionProvider";
import {
  default_connection,
  load_connection,
  save_connection
} from "./connection_preferences";
import styles from "./SessionLauncher.module.css";

const source_labels: Record<TransmissionSource, { title: string; detail: string }> = {
  synced: {
    title: "Daktronics Sync",
    detail: "Monitor the live controller feed with manual takeover available."
  },
  manual: {
    title: "Manual Control",
    detail: "Operate the scoreboard directly from this console."
  }
};

export function SessionLauncher() {
  const { capabilities, launch } = use_session();
  const [sport, set_sport] = useState<SportId>("football");
  const [source, set_source] = useState<TransmissionSource>("synced");
  const [connection, set_connection] = useState(() => {
    try {
      return load_connection(window.localStorage);
    } catch {
      return default_connection;
    }
  });
  const [error, set_error] = useState<string | null>(null);
  const selected_capability = useMemo(
    () => capabilities.find((entry) => entry.sport === sport),
    [capabilities, sport]
  );

  useEffect(() => {
    if (
      selected_capability !== undefined &&
      !selected_capability.supported_sources.includes(source)
    ) {
      set_source(selected_capability.supported_sources[0] ?? "manual");
    }
  }, [selected_capability, source]);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    set_error(null);
    if (source === "synced") {
      if (!connection.ip.trim() || !connection.device_id.trim()) {
        set_error("IP address and Device ID are required");
        return;
      }
      if (connection.port < 1 || connection.port > 65535) {
        set_error("Port must be between 1 and 65535");
        return;
      }
      try {
        save_connection(window.localStorage, connection);
      } catch {
        // Connection can still launch when browser storage is unavailable.
      }
    }
    void launch({ sport, source, ...(source === "synced" ? { connection } : {}) }).catch((reason: unknown) => {
      set_error(reason instanceof Error ? reason.message : "Unable to launch session");
    });
  };

  return (
    <main className={styles.page}>
      <header className={styles.brand}>
        <span className={styles.brandMark}>DD</span>
        <span>DakDash Operator</span>
      </header>
      <form className={styles.launcher} onSubmit={submit}>
        <div className={styles.heading}>
          <p className={styles.eyebrow}>Live operator console</p>
          <h1>Launch a session</h1>
          <p>Choose the scoreboard and how this game will be controlled. These stay fixed until you launch a new session.</p>
        </div>

        <fieldset className={styles.fieldset}>
          <legend>Sport</legend>
          <div className={styles.cardGrid}>
            {capabilities.map((capability) => (
              <label className={styles.choiceCard} key={capability.sport}>
                <input
                  type="radio"
                  name="sport"
                  value={capability.sport}
                  checked={sport === capability.sport}
                  onChange={() => set_sport(capability.sport)}
                />
                <span className={styles.choiceTitle}>{capability.display_name}</span>
                <span className={styles.choiceDetail}>Live scoreboard graphics</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend>Transmission method</legend>
          <div className={styles.sourceGrid}>
            {(["synced", "manual"] as const).map((candidate) => {
              const available = selected_capability?.supported_sources.includes(candidate) ?? false;
              return (
                <label className={styles.choiceCard} key={candidate} aria-disabled={!available}>
                  <input
                    type="radio"
                    name="source"
                    value={candidate}
                    checked={source === candidate}
                    disabled={!available}
                    onChange={() => set_source(candidate)}
                  />
                  <span className={styles.choiceTitle}>{source_labels[candidate].title}</span>
                  <span className={styles.choiceDetail}>
                    {available ? source_labels[candidate].detail : "Unavailable for this sport."}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {source === "synced" && (
          <fieldset className={styles.fieldset}>
            <legend>TCP connection</legend>
            <div className={styles.connectionGrid}>
              <label>
                IP address
                <input
                  aria-label="IP address"
                  required
                  value={connection.ip}
                  onChange={(event) =>
                    set_connection((current) => ({ ...current, ip: event.target.value }))
                  }
                />
              </label>
              <label>
                Port
                <input
                  aria-label="Port"
                  type="number"
                  min="1"
                  max="65535"
                  required
                  value={connection.port}
                  onChange={(event) =>
                    set_connection((current) => ({ ...current, port: Number(event.target.value) }))
                  }
                />
              </label>
              <label>
                Device ID
                <input
                  aria-label="Device ID"
                  required
                  value={connection.device_id}
                  onChange={(event) =>
                    set_connection((current) => ({ ...current, device_id: event.target.value }))
                  }
                />
              </label>
            </div>
          </fieldset>
        )}

        {error && <p className={styles.error}>{error}</p>}
        <button
          className={styles.launchButton}
          type="submit"
          disabled={selected_capability === undefined}
        >
          Launch session
        </button>
      </form>
    </main>
  );
}
