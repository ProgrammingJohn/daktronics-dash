import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { FakeBackendClient } from "../../api/FakeBackendClient";
import { SessionProvider } from "../../state/SessionProvider";
import { SessionLauncher } from "./SessionLauncher";

describe("SessionLauncher", () => {
  test("shows explicit sport and source cards and launches the selected session", async () => {
    const client = new FakeBackendClient();
    render(
      <SessionProvider client={client}>
        <SessionLauncher />
      </SessionProvider>
    );

    expect(await screen.findByRole("radio", { name: /Football/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Daktronics Sync/i })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Manual Control/i })).toBeEnabled();

    screen.getByRole("radio", { name: /Basketball/i }).click();
    screen.getByRole("radio", { name: /Manual Control/i }).click();
    screen.getByRole("button", { name: "Launch session" }).click();

    await waitFor(async () => {
      const snapshot = await client.get_active_snapshot();
      expect(snapshot.session.sport).toBe("basketball");
      expect(snapshot.session.source).toBe("manual");
    });
  });
});
