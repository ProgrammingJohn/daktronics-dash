import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Step3ConnectionSetup } from "@/steps/Step3ConnectionSetup";

describe("Step3ConnectionSetup", () => {
  it("shows validation errors for invalid live settings", () => {
    render(
      <Step3ConnectionSetup
        controlMode="live"
        espIp=""
        espPort="99999"
        backendBaseUrl="not-a-url"
        onControlModeChange={vi.fn()}
        onInputChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Enter a valid ESP32 IP or hostname.")).toBeInTheDocument();
    expect(screen.getByText("Port must be 1-65535.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid backend URL.")).toBeInTheDocument();
  });

  it("disables ESP fields in manual mode", () => {
    render(
      <Step3ConnectionSetup
        controlMode="manual"
        espIp="192.168.1.55"
        espPort="8000"
        backendBaseUrl="http://127.0.0.1:5001"
        onControlModeChange={vi.fn()}
        onInputChange={vi.fn()}
      />,
    );

    expect(screen.getByPlaceholderText("192.168.1.80")).toBeDisabled();
    expect(screen.getByPlaceholderText("8000")).toBeDisabled();
  });
});
