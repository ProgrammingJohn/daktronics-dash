import { BaseballControls } from "@/controls/BaseballControls";
import { BasketballControls } from "@/controls/BasketballControls";
import { FootballControls } from "@/controls/FootballControls";
import { StatusBar } from "@/components/StatusBar";
import { SvgPreview } from "@/components/SvgPreview";
import type { ConnectionState, ControlMode, HealthState, ScoreboardState, Sport } from "@/state/types";

interface Step4DashboardProps {
  selectedSport: Sport;
  controlMode: ControlMode;
  scoreState: ScoreboardState | null;
  connectionState: ConnectionState | null;
  healthState: HealthState | null;
  backendBaseUrl: string;
  pingMs: number | null;
  sessionStarted: boolean;
  renderedSvg: string;
  previewLoading?: boolean;
  previewError?: string | null;
  onRefresh: () => void;
  onStopSession: () => void;
  onControlModeChange: (mode: ControlMode) => void;
  onManualUpdate: (patch: Record<string, unknown>) => void;
}

export function Step4Dashboard({
  selectedSport,
  controlMode,
  scoreState,
  connectionState,
  healthState,
  backendBaseUrl,
  pingMs,
  sessionStarted,
  renderedSvg,
  previewLoading,
  previewError,
  onRefresh,
  onStopSession,
  onControlModeChange,
  onManualUpdate,
}: Step4DashboardProps): JSX.Element {
  const manualDisabled = controlMode !== "manual";

  return (
    <section className="step-layout">
      <h2>Step 4: Dashboard</h2>
      <p>Monitor connection/runtime state and operate the scoreboard.</p>

      <StatusBar
        controlMode={controlMode}
        sessionStarted={sessionStarted}
        connection={connectionState}
        health={healthState}
        pingMs={pingMs}
        backendUrl={backendBaseUrl}
      />

      <div className="panel panel-inline">
        <div className="button-row">
          <button
            type="button"
            className={`button ${controlMode === "manual" ? "button-active" : "button-ghost"}`}
            onClick={() => onControlModeChange("manual")}
          >
            Manual Mode
          </button>
          <button
            type="button"
            className={`button ${controlMode === "live" ? "button-active" : "button-ghost"}`}
            onClick={() => onControlModeChange("live")}
          >
            Live Mode
          </button>
        </div>

        <div className="button-row">
          <button type="button" className="button button-ghost" onClick={onRefresh}>
            Refresh Now
          </button>
          <button type="button" className="button button-ghost" onClick={onStopSession}>
            Stop Session
          </button>
        </div>
      </div>

      <div className="grid-two">
        <div className="panel">
          <h3>Current Overlay</h3>
          <SvgPreview
            svg={renderedSvg}
            loading={previewLoading}
            error={previewError}
            emptyLabel="No rendered SVG yet."
          />
        </div>

        <div>
          {selectedSport === "football" ? (
            <FootballControls state={scoreState} disabled={manualDisabled} onSubmit={onManualUpdate} />
          ) : null}
          {selectedSport === "basketball" ? (
            <BasketballControls state={scoreState} disabled={manualDisabled} onSubmit={onManualUpdate} />
          ) : null}
          {selectedSport === "baseball" ? (
            <BaseballControls state={scoreState} disabled={manualDisabled} onSubmit={onManualUpdate} />
          ) : null}

          {manualDisabled ? (
            <div className="panel panel-note">
              Manual writes are disabled while live mode is active. Incoming ESP32 updates remain the source of truth.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
