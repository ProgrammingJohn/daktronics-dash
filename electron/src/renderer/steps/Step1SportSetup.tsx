import type { HealthState, Sport, SportsAndModes } from "@/state/types";

import { SelectField } from "@/components/FormControls";

interface Step1SportSetupProps {
  selectedSport: Sport | null;
  sportsAndModes: SportsAndModes | null;
  health: HealthState | null;
  onSelectSport: (sport: Sport) => void;
  onRefreshHealth: () => void;
}

function healthClass(status: string | undefined): string {
  if (!status) return "status-pill-muted";
  if (status === "ok") return "status-pill-good";
  return "status-pill-bad";
}

export function Step1SportSetup({
  selectedSport,
  sportsAndModes,
  health,
  onSelectSport,
  onRefreshHealth,
}: Step1SportSetupProps): JSX.Element {
  const options = (sportsAndModes?.names || []).map((sport) => ({
    value: sport,
    label: sport[0].toUpperCase() + sport.slice(1),
  }));

  return (
    <section className="step-layout">
      <h2>Step 1: Sport Setup</h2>
      <p>Select the sport before moving to template customization.</p>

      <div className="panel">
        <SelectField
          id="sport"
          label="Sport"
          value={selectedSport || ""}
          options={[
            { value: "", label: options.length ? "Select a sport" : "Loading sports..." },
            ...options,
          ]}
          onChange={(value) => {
            if (value === "football" || value === "basketball" || value === "baseball") {
              onSelectSport(value);
            }
          }}
        />

        {selectedSport && sportsAndModes ? (
          <div className="capability-row">
            <strong>Supported modes:</strong>
            <span>Manual: {sportsAndModes.modes[selectedSport]?.manual ? "yes" : "no"}</span>
            <span>Live: {sportsAndModes.modes[selectedSport]?.synced ? "yes" : "no"}</span>
          </div>
        ) : null}
      </div>

      <div className="panel panel-inline">
        <div className="status-group">
          <span className="status-label">Backend health</span>
          <span className={`status-pill ${healthClass(health?.status)}`}>{health?.status || "unknown"}</span>
        </div>
        <button type="button" className="button button-ghost" onClick={onRefreshHealth}>
          Refresh
        </button>
      </div>
    </section>
  );
}
