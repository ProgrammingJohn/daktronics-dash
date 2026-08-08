import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { FakeBackendClient } from "../../api/FakeBackendClient";
import type { LaunchSessionInput, SessionSnapshot } from "../../domain/session";
import { SessionProvider } from "../../state/SessionProvider";
import { App } from "../App";

function fill_synced_connection(): void {
  fireEvent.change(screen.getByLabelText("IP address"), { target: { value: "10.0.0.20" } });
  fireEvent.change(screen.getByLabelText("Device ID"), { target: { value: "wt32-test" } });
}

describe("OperatorConsole", () => {
  const write_text = vi.fn(async () => undefined);

  beforeEach(() => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    write_text.mockClear();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: write_text }
    });
  });

  test("shows immutable session identity and monitoring-first synced actions", async () => {
    render(
      <SessionProvider client={new FakeBackendClient()}>
        <App />
      </SessionProvider>
    );

    await screen.findByRole("radio", { name: /Football/i });
    fill_synced_connection();
    screen.getByRole("button", { name: "Launch session" }).click();

    expect(await screen.findByRole("heading", { name: "Football" })).toBeVisible();
    expect(screen.getByText("Daktronics Sync")).toBeVisible();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getAllByText("LIVE")[0]).toBeVisible();
    expect(screen.getByText("Transport")).toBeVisible();
    expect(screen.getByText("Connection state")).toBeVisible();
    expect(screen.getByRole("button", { name: "Take manual control…" })).toBeVisible();
    expect(screen.queryByText("Manual controls")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Team titles and colors" })).toBeVisible();
  });

  test("shows and copies the absolute OBS viewer URL", async () => {
    render(
      <SessionProvider client={new FakeBackendClient()}>
        <App />
      </SessionProvider>
    );
    await screen.findByRole("radio", { name: /Football/i });
    fill_synced_connection();
    screen.getByRole("button", { name: "Launch session" }).click();

    const viewer_url = `${window.location.origin}/viewer`;
    expect(await screen.findByLabelText("OBS viewer URL")).toHaveValue(viewer_url);
    screen.getByRole("button", { name: "Copy OBS URL" }).click();

    await waitFor(() => expect(write_text).toHaveBeenCalledWith(viewer_url));
  });

  test("contains the baseball SVG inside the program preview", async () => {
    render(
      <SessionProvider client={new FakeBackendClient()}>
        <App />
      </SessionProvider>
    );
    (await screen.findByRole("radio", { name: /Baseball/i })).click();
    screen.getByRole("radio", { name: /Manual Control/i }).click();
    screen.getByRole("button", { name: "Launch session" }).click();

    const preview = await screen.findByRole("region", { name: "Program preview" });
    await waitFor(() => {
      const host = [...preview.querySelectorAll("div")].find(
        (element) => element.shadowRoot !== null
      );
      expect(host).toHaveStyle({ height: "300px", overflow: "hidden" });
      expect(host?.shadowRoot?.querySelector("svg")).toBeInTheDocument();
    });
  });

  test("shows discovery diagnostics with explicit retry and manual-IP recovery", async () => {
    class NotFoundBackendClient extends FakeBackendClient {
      retry_count = 0;

      override async launch_session(
        input: LaunchSessionInput,
        signal?: AbortSignal
      ): Promise<SessionSnapshot> {
        const snapshot = await super.launch_session(input, signal);
        return {
          ...snapshot,
          connection: {
            ...snapshot.connection,
            discovery: {
              phase: "NOT_FOUND",
              active: false,
              attempts: 3,
              method: null,
              requested_host: null,
              resolved_host: null
            }
          }
        };
      }

      override async retry_sync(): Promise<SessionSnapshot> {
        this.retry_count += 1;
        const snapshot = await this.get_active_snapshot();
        return {
          ...snapshot,
          connection: {
            ...snapshot.connection,
            discovery: {
              phase: "PASSIVE_LOOKUP",
              active: true,
              attempts: 0,
              method: null,
              requested_host: null,
              resolved_host: null
            }
          }
        };
      }
    }

    const client = new NotFoundBackendClient();
    render(
      <SessionProvider client={client}>
        <App />
      </SessionProvider>
    );
    await screen.findByRole("radio", { name: /Football/i });
    fill_synced_connection();
    screen.getByRole("button", { name: "Launch session" }).click();

    expect(await screen.findByText("Device not found")).toBeVisible();
    expect(screen.getByText("NOT_FOUND")).toBeVisible();
    expect(screen.getByText("3")).toBeVisible();
    screen.getByRole("button", { name: "Retry discovery" }).click();
    await waitFor(() => expect(client.retry_count).toBe(1));
    expect(await screen.findByText("Checking for the device locally…")).toBeVisible();

    screen.getByRole("button", { name: "Enter IP manually" }).click();
    expect(await screen.findByRole("radio", { name: /Enter IP manually/i })).toBeChecked();
  });

  test("loads saved team titles and gradients while monitoring a synced session", async () => {
    const client = new FakeBackendClient();
    const appearance = await client.load_appearance("football");
    appearance.profiles[0]!.abbreviation = "DEVILS";
    appearance.profiles[0]!.light = "#336699";
    appearance.profiles[0]!.dark = "#112233";
    await client.save_appearance(appearance);
    await client.launch_session({ sport: "football", source: "synced" });

    render(
      <SessionProvider client={client}>
        <App />
      </SessionProvider>
    );

    await screen.findByRole("heading", { name: "Football" });
    const preview = screen.getByRole("region", { name: "Program preview" });
    await waitFor(() => {
      const host = [...preview.querySelectorAll("div")].find(
        (element) => element.shadowRoot !== null
      );
      const root = host?.shadowRoot;
      expect(root?.querySelector('[data-score-field="home_team_name"]')).toHaveTextContent(
        "DEVILS"
      );
      const svg = root?.querySelector<SVGSVGElement>(
        '[data-appearance-field="scoreboard_root"]'
      );
      expect(svg?.style.getPropertyValue("--home_team_light")).toBe("#336699");
      expect(svg?.style.getPropertyValue("--home_team_dark")).toBe("#112233");
    });
  });

  test("requires confirmation before returning to the launcher", async () => {
    render(
      <SessionProvider client={new FakeBackendClient()}>
        <App />
      </SessionProvider>
    );
    await screen.findByRole("radio", { name: /Football/i });
    fill_synced_connection();
    screen.getByRole("button", { name: "Launch session" }).click();
    await screen.findByRole("heading", { name: "Football" });

    screen.getByRole("button", { name: "Launch new session…" }).click();
    expect(confirm).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Football" })).toBeVisible();

    vi.mocked(confirm).mockReturnValue(true);
    screen.getByRole("button", { name: "Launch new session…" }).click();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Launch a session" })).toBeVisible());
  });
});
