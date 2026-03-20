import { describe, expect, it } from "vitest";

import { appStateReducer, initialAppState } from "@/state/AppStateContext";

describe("appStateReducer", () => {
  it("sets sport and template together", () => {
    const next = appStateReducer(initialAppState, { type: "SET_SPORT", sport: "football" });

    expect(next.selectedSport).toBe("football");
    expect(next.selectedTemplate).toBe("football.svg");
  });

  it("filters live warning when mode switches to manual", () => {
    const withWarning = {
      ...initialAppState,
      warnings: ["Live updates are not healthy (connection: disconnected).", "Backend health check failed."],
    };

    const next = appStateReducer(withWarning, { type: "SET_CONTROL_MODE", mode: "manual" });

    expect(next.controlMode).toBe("manual");
    expect(next.warnings).toEqual(["Backend health check failed."]);
  });

  it("resets runtime-specific fields after stop", () => {
    const running = {
      ...initialAppState,
      wizardStep: 4 as const,
      sessionStarted: true,
      warnings: ["warning"],
      pingMs: 30,
    };

    const next = appStateReducer(running, { type: "RESET_AFTER_STOP" });

    expect(next.sessionStarted).toBe(false);
    expect(next.wizardStep).toBe(3);
    expect(next.warnings).toEqual([]);
    expect(next.pingMs).toBeNull();
  });
});
