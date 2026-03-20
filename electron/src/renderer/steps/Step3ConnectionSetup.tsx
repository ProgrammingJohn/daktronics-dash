import { RadioCardGroup, TextField } from "@/components/FormControls";
import type { ControlMode } from "@/state/types";
import { isValidBackendUrl, isValidEspHost, isValidPort } from "@/utils/validators";

interface Step3ConnectionSetupProps {
  controlMode: ControlMode;
  espIp: string;
  espPort: string;
  backendBaseUrl: string;
  onControlModeChange: (mode: ControlMode) => void;
  onInputChange: (patch: { espIp?: string; espPort?: string; backendBaseUrl?: string }) => void;
}

export function Step3ConnectionSetup({
  controlMode,
  espIp,
  espPort,
  backendBaseUrl,
  onControlModeChange,
  onInputChange,
}: Step3ConnectionSetupProps): JSX.Element {
  const espIpError = controlMode === "live" && !isValidEspHost(espIp) ? "Enter a valid ESP32 IP or hostname." : null;
  const espPortError = controlMode === "live" && !isValidPort(espPort) ? "Port must be 1-65535." : null;
  const backendUrlError = !isValidBackendUrl(backendBaseUrl) ? "Enter a valid backend URL." : null;

  return (
    <section className="step-layout">
      <h2>Step 3: Connection Setup</h2>
      <p>Choose control mode and configure the backend target plus live-device connection inputs.</p>

      <div className="panel">
        <RadioCardGroup
          label="Control Mode"
          value={controlMode}
          options={[
            {
              value: "manual",
              label: "Manual",
              description: "You edit score state directly from this dashboard.",
            },
            {
              value: "live",
              label: "Live",
              description: "Backend connects to ESP32 using the entered IP/port.",
            },
          ]}
          onChange={(value) => {
            if (value === "manual" || value === "live") {
              onControlModeChange(value);
            }
          }}
        />
      </div>

      <div className="grid-two">
        <div className="panel">
          <h3>Backend Target</h3>
          <TextField
            id="backendBaseUrl"
            label="Flask Base URL"
            value={backendBaseUrl}
            onChange={(value) => onInputChange({ backendBaseUrl: value })}
            placeholder="http://127.0.0.1:5001"
            error={backendUrlError}
            helperText="Default local backend URL."
          />
        </div>

        <div className="panel">
          <h3>ESP32 Target</h3>
          <TextField
            id="espIp"
            label="ESP32 IP / Host"
            value={espIp}
            onChange={(value) => onInputChange({ espIp: value })}
            placeholder="192.168.1.80"
            disabled={controlMode !== "live"}
            error={espIpError}
            helperText="Required in live mode."
          />
          <TextField
            id="espPort"
            label="ESP32 Port"
            value={espPort}
            onChange={(value) => onInputChange({ espPort: value })}
            placeholder="8000"
            disabled={controlMode !== "live"}
            error={espPortError}
            helperText="Required in live mode."
          />
        </div>
      </div>
    </section>
  );
}
