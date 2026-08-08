import { act } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { BackendSnapshotSource } from "./BackendSnapshotSource";
import { FakeBackendClient } from "./FakeBackendClient";

describe("BackendSnapshotSource", () => {
  afterEach(() => vi.useRealTimers());

  test("loads, subscribes, validates updates, and stops subscription and heartbeats on abort", async () => {
    vi.useFakeTimers();
    const client = new FakeBackendClient();
    const launched = await client.launch_session({ sport: "football", source: "synced" });
    const source = new BackendSnapshotSource(client);
    const controller = new AbortController();
    const received: number[] = [];
    const errors: Error[] = [];

    source.subscribe(
      controller.signal,
      (snapshot) => received.push((snapshot as typeof launched).scoreboard.revision),
      (error) => errors.push(error)
    );
    await act(async () => Promise.resolve());
    expect(received).toEqual([0]);
    expect(client.active_subscription_count).toBe(1);

    client.publish_synced({ ...launched.scoreboard.fields, home_score: 7 });
    expect(received).toEqual([0, 1]);

    await vi.advanceTimersByTimeAsync(2100);
    expect(client.viewer_heartbeat_count).toBe(2);

    controller.abort();
    expect(client.active_subscription_count).toBe(0);
    await vi.advanceTimersByTimeAsync(2000);
    expect(client.viewer_heartbeat_count).toBe(2);
    expect(errors).toEqual([]);
  });
});
