import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, test, vi } from "vitest";
import { FakeBackendClient } from "../../api/FakeBackendClient";
import { SessionProvider } from "../../state/SessionProvider";
import { App } from "../App";

async function launch_and_open(): Promise<void> {
  await screen.findByRole("radio", { name: /Football/i });
  screen.getByRole("button", { name: "Launch session" }).click();
  await screen.findByRole("heading", { name: "Football" });
  screen.getByRole("button", { name: "Appearance settings" }).click();
  await screen.findByRole("dialog", { name: "Appearance settings" });
}

function live_home_name(): string | null {
  const preview = screen.getByRole("region", { name: "Program preview" });
  const host = [...preview.querySelectorAll("div")].find((element) => element.shadowRoot !== null);
  return host?.shadowRoot?.querySelector('[data-score-field="home_team_name"]')?.textContent ?? null;
}

describe("AppearanceEditor", () => {
  test("keeps edits in a staging renderer and discards them on cancel", async () => {
    render(
      <StrictMode>
        <SessionProvider client={new FakeBackendClient()}>
          <App />
        </SessionProvider>
      </StrictMode>
    );
    await launch_and_open();
    const before = live_home_name();

    fireEvent.change(screen.getByLabelText("Home abbreviation"), { target: { value: "TIGERS" } });
    expect(live_home_name()).toBe(before);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Appearance settings" })).not.toBeInTheDocument()
    );
    expect(live_home_name()).toBe(before);
  });

  test("saves one complete payload and refreshes the live preview on apply", async () => {
    const client = new FakeBackendClient();
    const save = vi.spyOn(client, "save_appearance");
    render(
      <StrictMode>
        <SessionProvider client={client}>
          <App />
        </SessionProvider>
      </StrictMode>
    );
    await launch_and_open();

    fireEvent.change(screen.getByLabelText("Home abbreviation"), { target: { value: "TIGERS" } });
    screen.getByRole("button", { name: "Apply to broadcast" }).click();

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0]?.[0]).toMatchObject({ schema_version: 1, sport: "football" });
    await waitFor(() => expect(live_home_name()).toBe("TIGERS"));
  });
});
