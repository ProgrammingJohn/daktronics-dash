import type { ConnectionState, ControlMode, HealthState } from "@/state/types";

interface StatusBarProps {
  controlMode: ControlMode;
  sessionStarted: boolean;
  connection: ConnectionState | null;
  health: HealthState | null;
  pingMs: number | null;
  backendUrl: string;
}

function statusClass(status: string | undefined): string {
  if (!status) return "status-pill-muted";
  if (status === "connected" || status === "ok" || status === "manual") return "status-pill-good";
  if (status === "connecting" || status === "stale") return "status-pill-warn";
  return "status-pill-bad";
}

export function StatusBar({
  controlMode,
  sessionStarted,
  connection,
  health,
  pingMs,
  backendUrl,
}: StatusBarProps): JSX.Element {
  return (
    <section className="status-bar">
      <div className="status-group">
        <span className="status-label">Session</span>
        <span className={`status-pill ${sessionStarted ? "status-pill-good" : "status-pill-muted"}`}>
          {sessionStarted ? "running" : "stopped"}
        </span>
      </div>

      <div className="status-group">
        <span className="status-label">Mode</span>
        <span className={`status-pill ${controlMode === "live" ? "status-pill-warn" : "status-pill-good"}`}>
          {controlMode}
        </span>
      </div>

      <div className="status-group">
        <span className="status-label">Connection</span>
        <span className={`status-pill ${statusClass(connection?.status)}`}>{connection?.status || "unknown"}</span>
      </div>

      <div className="status-group">
        <span className="status-label">Protocol</span>
        <span className="status-pill status-pill-muted">{connection?.protocol_mode || "unknown"}</span>
      </div>

      <div className="status-group">
        <span className="status-label">Backend</span>
        <span className={`status-pill ${statusClass(health?.status)}`}>{health?.status || "unreachable"}</span>
      </div>

      <div className="status-group">
        <span className="status-label">Ping</span>
        <span className="status-pill status-pill-muted">{pingMs !== null ? `${pingMs} ms` : "--"}</span>
      </div>

      <div className="status-group status-meta">
        <span className="status-label">Target</span>
        <span className="status-meta-text">{backendUrl}</span>
      </div>

      {connection?.last_error ? (
        <div className="status-group status-meta">
          <span className="status-label">Last error</span>
          <span className="status-meta-text status-text-error">{connection.last_error}</span>
        </div>
      ) : null}
    </section>
  );
}
