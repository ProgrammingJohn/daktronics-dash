import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { FakeBackendClient } from "../../api/FakeBackendClient";
import { SessionProvider } from "../../state/SessionProvider";
import { App } from "../App";

function fill_synced_connection(): void {
  fireEvent.change(screen.getByLabelText("IP address"), { target: { value: "10.0.0.20" } });
  fireEvent.change(screen.getByLabelText("Device ID"), { target: { value: "wt32-test" } });
}

describe("OperatorConsole", () => {
  beforeEach(() => vi.stubGlobal("confirm", vi.fn(() => false)));

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
