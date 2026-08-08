import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { FakeBackendClient } from "../../api/FakeBackendClient";
import { SessionProvider } from "../../state/SessionProvider";
import { App } from "../App";

async function launch_manual(client: FakeBackendClient): Promise<void> {
  await screen.findByRole("radio", { name: /Football/i });
  screen.getByRole("radio", { name: /Manual Control/i }).click();
  screen.getByRole("button", { name: "Launch session" }).click();
  await screen.findByRole("heading", { name: "Manual controls" });
  expect((await client.get_active_snapshot()).session.control_authority).toBe("manual");
}

describe("ManualControlDeck", () => {
  test("manual-only sessions mount controls and score buttons submit complete state", async () => {
    const client = new FakeBackendClient();
    render(
      <SessionProvider client={client}>
        <App />
      </SessionProvider>
    );
    await launch_manual(client);

    screen.getByRole("button", { name: "Home score increase" }).click();

    await waitFor(async () => {
      const snapshot = await client.get_active_snapshot();
      expect(snapshot.scoreboard.fields.home_score).toBe(1);
      expect(Object.keys(snapshot.scoreboard.fields).length).toBeGreaterThan(5);
    });
  });

  test("clock edits stay local until Set clock is pressed", async () => {
    const client = new FakeBackendClient();
    render(
      <SessionProvider client={client}>
        <App />
      </SessionProvider>
    );
    await launch_manual(client);

    fireEvent.change(screen.getByLabelText("Game clock minutes"), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText("Game clock seconds"), { target: { value: "12" } });
    expect((await client.get_active_snapshot()).scoreboard.revision).toBe(0);

    screen.getByRole("button", { name: "Set clock" }).click();
    await waitFor(async () => {
      const snapshot = await client.get_active_snapshot();
      expect(snapshot.scoreboard.fields.clock).toEqual({ minutes: 8, seconds: 12 });
    });
  });

  test("synced sessions hide controls until confirmed takeover", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    render(
      <SessionProvider client={new FakeBackendClient()}>
        <App />
      </SessionProvider>
    );
    await screen.findByRole("radio", { name: /Football/i });
    screen.getByRole("button", { name: "Launch session" }).click();
    await screen.findByRole("button", { name: "Take manual control…" });
    expect(screen.queryByRole("heading", { name: "Manual controls" })).not.toBeInTheDocument();

    screen.getByRole("button", { name: "Take manual control…" }).click();
    expect(await screen.findByRole("heading", { name: "Manual controls" })).toBeVisible();
  });
});
