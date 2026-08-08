import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { AppearancePayload, SessionSnapshot } from "../domain/session";
import { basketball_live } from "../sports/basketball/fixtures";
import { football_live } from "../sports/football/fixtures";
import { FakeSnapshotSource } from "./fake_snapshot_source";
import { Viewer } from "./Viewer";

function snapshot(
  sport: "basketball" | "football",
  fields: Record<string, unknown>,
  revision: number,
  session_id = `${sport}-session`
): SessionSnapshot {
  return {
    session: {
      session_id,
      sport,
      source: "synced",
      control_authority: "daktronics"
    },
    connection: {
      status: "live",
      backend_status: "connected",
      last_update_at: "2026-08-08T16:00:00.000Z",
      source_age_ms: 20,
      message: null
    },
    scoreboard: { revision, fields }
  };
}

function scoreboard_host(): HTMLElement {
  const host = screen
    .getByTestId("scoreboard-container")
    .querySelector<HTMLElement>("[data-viewer-scoreboard-host]");
  if (!host) throw new Error("Missing scoreboard host");
  return host;
}

function shadow_text(field: string): string | null {
  return scoreboard_host().shadowRoot?.querySelector(`[data-score-field="${field}"]`)?.textContent ?? null;
}

describe("Viewer", () => {
  afterEach(() => vi.useRealTimers());

  test("renders newer revisions and retains the last score after a source error", () => {
    const source = new FakeSnapshotSource();
    render(<Viewer source={source} />);

    act(() => source.emit(snapshot("football", { ...football_live, home_score: 7 }, 1)));
    expect(screen.getByTestId("viewer-status")).toHaveTextContent("live");
    expect(shadow_text("home_score")).toBe("7");

    act(() => source.emit(snapshot("football", { ...football_live, home_score: 99 }, 1)));
    expect(shadow_text("home_score")).toBe("7");

    act(() => source.fail(new Error("offline")));
    expect(screen.getByTestId("viewer-status")).toHaveTextContent("disconnected");
    expect(shadow_text("home_score")).toBe("7");
  });

  test("atomically swaps renderers when a new session selects another sport", () => {
    const source = new FakeSnapshotSource();
    render(<Viewer source={source} />);

    act(() => source.emit(snapshot("football", football_live, 8)));
    const football_host = scoreboard_host();

    act(() =>
      source.emit(snapshot("basketball", { ...basketball_live, clock: "7:04" }, 1))
    );

    expect(scoreboard_host()).not.toBe(football_host);
    expect(shadow_text("clock")).toBe("7:04");
  });

  test("retains the current renderer when a snapshot is malformed", () => {
    const source = new FakeSnapshotSource();
    render(<Viewer source={source} />);
    act(() => source.emit(snapshot("football", { ...football_live, home_score: 14 }, 1)));

    act(() => source.emit(snapshot("football", { invalid: true }, 2)));

    expect(screen.getByTestId("viewer-status")).toHaveTextContent("disconnected");
    expect(shadow_text("home_score")).toBe("14");
  });

  test("aborts the subscription and disposes the renderer on unmount", () => {
    const source = new FakeSnapshotSource();
    const { unmount } = render(<Viewer source={source} />);
    act(() => source.emit(snapshot("football", football_live, 1)));
    const host = scoreboard_host();

    unmount();

    expect(source.aborted).toBe(true);
    expect(host.shadowRoot?.childNodes).toHaveLength(0);
  });

  test("loads and refreshes team colors while the viewer remains open", async () => {
    vi.useFakeTimers();
    const source = new FakeSnapshotSource();
    let home_light = "#336699";
    const load_appearance = async (): Promise<AppearancePayload> => ({
      schema_version: 1,
      sport: "football",
      profiles: [
        {
          id: "football-home",
          display_name: "Home",
          abbreviation: "HHS",
          light: home_light,
          dark: "#112233",
          text: "#ffffff"
        },
        {
          id: "football-away",
          display_name: "Away",
          abbreviation: "CCS",
          light: "#dddddd",
          dark: "#333333",
          text: "#000000"
        }
      ],
      appearance: {
        sport: "football",
        home_profile_id: "football-home",
        away_profile_id: "football-away",
        token_overrides: {}
      }
    });
    render(<Viewer source={source} load_appearance={load_appearance} />);

    act(() => source.emit(snapshot("football", football_live, 1)));
    await act(async () => Promise.resolve());
    const initial_svg = scoreboard_host().shadowRoot?.querySelector<SVGSVGElement>(
      '[data-appearance-field="scoreboard_root"]'
    );
    expect(initial_svg?.style.getPropertyValue("--home_team_light")).toBe("#336699");

    home_light = "#2b65ad";
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    const svg = scoreboard_host().shadowRoot?.querySelector<SVGSVGElement>(
      '[data-appearance-field="scoreboard_root"]'
    );
    expect(svg?.style.getPropertyValue("--home_team_light")).toBe("#2b65ad");
  });
});
