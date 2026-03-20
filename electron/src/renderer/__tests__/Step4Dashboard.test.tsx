import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Step4Dashboard } from "@/steps/Step4Dashboard";

describe("Step4Dashboard", () => {
  const baseProps = {
    selectedSport: "football" as const,
    scoreState: {
      home_score: 7,
      away_score: 3,
      period: 2,
      down: 1,
      yards_to_go: 10,
      clock: { minutes: "10", seconds: "12" },
    },
    connectionState: {
      status: "connected",
      protocol_mode: "json_v1",
    },
    healthState: {
      status: "ok",
    },
    backendBaseUrl: "http://127.0.0.1:5001",
    pingMs: 25,
    sessionStarted: true,
    renderedSvg: "<svg></svg>",
    onRefresh: vi.fn(),
    onStopSession: vi.fn(),
    onControlModeChange: vi.fn(),
    onManualUpdate: vi.fn(),
  };

  it("shows live-mode manual lock note", () => {
    render(<Step4Dashboard {...baseProps} controlMode="live" />);

    expect(screen.getByText(/Manual writes are disabled while live mode is active/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply Update" })).toBeDisabled();
  });

  it("allows manual controls in manual mode", () => {
    render(<Step4Dashboard {...baseProps} controlMode="manual" />);

    expect(screen.queryByText(/Manual writes are disabled while live mode is active/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply Update" })).toBeEnabled();
  });
});
