import { describe, expect, test, vi } from "vitest";
// @ts-ignore The legacy wizard remains plain browser JavaScript.
import { map_connection_status, poll_score_revision, start_synced_polling, stop_synced_polling } from "../../../../static/js/wizard/synced_polling.js";

describe("legacy synced polling", () => {
  test.each([
    ["LIVE", "live"],
    ["STALE_SOURCE", "stale"],
    ["WAITING_FOR_CLIENT", "stale"],
    ["DISCONNECTED", "disconnected"],
    ["INCOMPATIBLE", "disconnected"]
  ])("maps %s to %s", (backend_status, expected) => {
    expect(map_connection_status(backend_status)).toBe(expected);
  });

  test("fetches a new revision even while disconnected and otherwise retains the score", async () => {
    const get_score = vi.fn(async () => ({ home_score: 14 }));
    const on_score = vi.fn();

    const next = await poll_score_revision(
      { status: "DISCONNECTED", revision: 8 },
      7,
      get_score,
      on_score
    );
    expect(next).toBe(8);
    expect(on_score).toHaveBeenCalledWith({ home_score: 14 });

    const unchanged = await poll_score_revision(
      { status: "STALE_SOURCE", revision: 8 },
      next,
      get_score,
      on_score
    );
    expect(unchanged).toBe(8);
    expect(get_score).toHaveBeenCalledTimes(1);
  });

  test("replaces the prior interval when initialized repeatedly", () => {
    const set_interval = vi.fn(() => 12);
    const clear_interval = vi.fn();
    start_synced_polling(() => undefined, set_interval, clear_interval);
    start_synced_polling(() => undefined, set_interval, clear_interval);

    expect(set_interval).toHaveBeenCalledTimes(2);
    expect(clear_interval).toHaveBeenCalledWith(12);
    stop_synced_polling();
  });
});
