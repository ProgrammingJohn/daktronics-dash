import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { FakeBackendClient } from "../../api/FakeBackendClient";
import { SessionProvider } from "../../state/SessionProvider";
import { App } from "../App";

describe("OperatorConsole", () => {
  beforeEach(() => vi.stubGlobal("confirm", vi.fn(() => false)));

  test("shows immutable session identity and monitoring-first synced actions", async () => {
    render(
      <SessionProvider client={new FakeBackendClient()}>
        <App />
      </SessionProvider>
    );

    await screen.findByRole("radio", { name: /Football/i });
    screen.getByRole("button", { name: "Launch session" }).click();

    expect(await screen.findByRole("heading", { name: "Football" })).toBeVisible();
    expect(screen.getByText("Daktronics Sync")).toBeVisible();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("LIVE")).toBeVisible();
    expect(screen.getByRole("button", { name: "Take manual control…" })).toBeVisible();
    expect(screen.queryByText("Manual controls")).not.toBeInTheDocument();
  });

  test("requires confirmation before returning to the launcher", async () => {
    render(
      <SessionProvider client={new FakeBackendClient()}>
        <App />
      </SessionProvider>
    );
    await screen.findByRole("radio", { name: /Football/i });
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
