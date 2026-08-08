import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { FakeBackendClient } from "../../api/FakeBackendClient";
import { SessionProvider } from "../../state/SessionProvider";
import { SessionLauncher } from "./SessionLauncher";

describe("SessionLauncher", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
        clear: () => values.clear()
      }
    });
  });

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

  test("collects and persists the synced TCP connection identity", async () => {
    window.localStorage.setItem(
      "dakdash.connection.v1",
      JSON.stringify({ ip: "10.0.0.20", port: 1234, device_id: "wt32-saved" })
    );
    const client = new FakeBackendClient();
    const launch = vi.spyOn(client, "launch_session");
    render(
      <SessionProvider client={client}>
        <SessionLauncher />
      </SessionProvider>
    );

    expect(await screen.findByLabelText("IP address")).toHaveValue("10.0.0.20");
    expect(screen.getByLabelText("Port")).toHaveValue(1234);
    expect(screen.getByLabelText("Device ID")).toHaveValue("wt32-saved");

    screen.getByRole("button", { name: "Launch session" }).click();

    await waitFor(() =>
      expect(launch).toHaveBeenCalledWith(
        {
          sport: "football",
          source: "synced",
          connection: {
            ip: "10.0.0.20",
            port: 1234,
            device_id: "wt32-saved"
          }
        },
        expect.any(AbortSignal)
      )
    );
    expect(JSON.parse(window.localStorage.getItem("dakdash.connection.v1") ?? "null")).toEqual({
      ip: "10.0.0.20",
      port: 1234,
      device_id: "wt32-saved"
    });
  });

  test("starts automatic discovery with a blank IP and one request", async () => {
    window.localStorage.setItem(
      "dakdash.connection.v1",
      JSON.stringify({ ip: "10.0.0.20", port: 1234, device_id: "wt32-943cc63d1287" })
    );
    const client = new FakeBackendClient();
    const launch = vi.spyOn(client, "launch_session");
    render(
      <SessionProvider client={client}>
        <SessionLauncher />
      </SessionProvider>
    );

    (await screen.findByRole("radio", { name: /Find device automatically/i })).click();
    const launch_button = screen.getByRole("button", { name: "Launch session" });
    fireEvent.click(launch_button);
    fireEvent.click(launch_button);

    await waitFor(() => expect(launch).toHaveBeenCalledTimes(1));
    expect(launch).toHaveBeenCalledWith(
      {
        sport: "football",
        source: "synced",
        connection: {
          ip: "",
          port: 1234,
          device_id: "wt32-943cc63d1287"
        }
      },
      expect.any(AbortSignal)
    );
  });
});
