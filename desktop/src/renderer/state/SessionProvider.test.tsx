import { act, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, test } from "vitest";
import { FakeBackendClient } from "../api/FakeBackendClient";
import { SessionProvider, use_session } from "./SessionProvider";

function Harness() {
  const session = use_session();
  const [error, set_error] = useState("");
  const accepted = session.state.accepted;

  return (
    <div>
      <output data-testid="phase">{session.state.phase}</output>
      <output data-testid="authority">{accepted?.session.control_authority ?? "none"}</output>
      <output data-testid="score">{String(accepted?.scoreboard.fields.home_score ?? "none")}</output>
      <output data-testid="error">{error}</output>
      <button onClick={() => void session.launch({ sport: "football", source: "synced" })}>
        launch
      </button>
      <button onClick={() => void session.take_manual_control().catch((value: Error) => set_error(value.message))}>
        takeover
      </button>
      <button
        onClick={() =>
          void session
            .transition({ ...accepted?.scoreboard.fields, home_score: 7 })
            .catch((value: Error) => set_error(value.message))
        }
      >
        score
      </button>
    </div>
  );
}

describe("SessionProvider", () => {
  test("launches, subscribes, takes over, submits manual state, and aborts on unmount", async () => {
    const client = new FakeBackendClient();
    const rendered = render(
      <SessionProvider client={client}>
        <Harness />
      </SessionProvider>
    );

    await act(async () => screen.getByRole("button", { name: "launch" }).click());
    await waitFor(() => expect(screen.getByTestId("phase")).toHaveTextContent("active"));
    expect(client.active_subscription_count).toBe(1);

    await act(async () => {
      const current = await client.get_active_snapshot();
      client.publish_synced({ ...current.scoreboard.fields, home_score: 3 });
    });

    await act(async () => screen.getByRole("button", { name: "takeover" }).click());
    await waitFor(() => expect(screen.getByTestId("authority")).toHaveTextContent("manual"));

    await act(async () => screen.getByRole("button", { name: "score" }).click());
    await waitFor(() => expect(screen.getByTestId("score")).toHaveTextContent("7"));

    rendered.unmount();
    expect(client.active_subscription_count).toBe(0);
  });
});
