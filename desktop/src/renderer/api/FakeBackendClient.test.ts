import { afterEach, describe, expect, test, vi } from "vitest";
import { FakeBackendClient } from "./FakeBackendClient";

function memory_storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key)
  };
}

describe("FakeBackendClient", () => {
  afterEach(() => vi.useRealTimers());

  test("lists all current sports and launches an immutable session identity", async () => {
    const client = new FakeBackendClient();
    const capabilities = await client.list_capabilities();

    expect(capabilities.map((entry) => entry.sport)).toEqual([
      "baseball",
      "basketball",
      "football"
    ]);
    expect(capabilities.every((entry) => entry.supported_sources.includes("manual"))).toBe(true);

    const launched = await client.launch_session({ sport: "football", source: "synced" });
    expect(launched.session.sport).toBe("football");
    expect(launched.session.source).toBe("synced");
    expect(launched.session.control_authority).toBe("daktronics");
  });

  test("increments revisions and copies the last synced score into manual takeover", async () => {
    const client = new FakeBackendClient();
    const launched = await client.launch_session({ sport: "football", source: "synced" });
    const synced = client.publish_synced({ ...launched.scoreboard.fields, home_score: 14 });
    const manual = await client.take_manual_control(synced.scoreboard.revision);

    expect(synced.scoreboard.revision).toBe(1);
    expect(manual.scoreboard.revision).toBe(2);
    expect(manual.session.control_authority).toBe("manual");
    expect(manual.scoreboard.fields.home_score).toBe(14);
    expect(() => client.publish_synced({ ...manual.scoreboard.fields, home_score: 21 })).toThrow(
      "Manual authority blocks synced publication"
    );
  });

  test("submits complete manual states and rejects revision conflicts", async () => {
    const client = new FakeBackendClient();
    const launched = await client.launch_session({ sport: "basketball", source: "manual" });
    const accepted = await client.submit_manual_transition({
      session_id: launched.session.session_id,
      expected_revision: 0,
      fields: { ...launched.scoreboard.fields, home_score: 3 }
    });

    expect(accepted.scoreboard.revision).toBe(1);
    expect(accepted.scoreboard.fields.home_score).toBe(3);
    await expect(
      client.submit_manual_transition({
        session_id: launched.session.session_id,
        expected_revision: 0,
        fields: accepted.scoreboard.fields
      })
    ).rejects.toThrow("Revision conflict");
  });

  test("returns to sync only while the retained synced state is fresh", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-08T16:00:00.000Z"));
    const client = new FakeBackendClient();
    const launched = await client.launch_session({ sport: "football", source: "synced" });
    const synced = client.publish_synced({ ...launched.scoreboard.fields, home_score: 10 });
    const manual = await client.take_manual_control(synced.scoreboard.revision);

    const returned = await client.return_to_sync(manual.scoreboard.revision);
    expect(returned.session.control_authority).toBe("daktronics");
    expect(returned.scoreboard.fields.home_score).toBe(10);

    const manual_again = await client.take_manual_control(returned.scoreboard.revision);
    vi.advanceTimersByTime(2001);
    await expect(client.return_to_sync(manual_again.scoreboard.revision)).rejects.toThrow(
      "Synced state is stale"
    );
  });

  test("persists cloned appearance payloads and records viewer heartbeats", async () => {
    const client = new FakeBackendClient();
    const original = await client.load_appearance("baseball");
    const changed = structuredClone(original);
    changed.profiles[0]!.display_name = "Tigers";
    const saved = await client.save_appearance(changed);
    changed.profiles[0]!.display_name = "mutated outside client";

    expect(saved.profiles[0]?.display_name).toBe("Tigers");
    expect((await client.load_appearance("baseball")).profiles[0]?.display_name).toBe("Tigers");

    const launched = await client.launch_session({ sport: "baseball", source: "manual" });
    await client.record_viewer_heartbeat(launched.session.session_id);
    expect(client.viewer_heartbeat_count).toBe(1);
  });

  test("checks abort signals before mutations and disposes subscriptions", async () => {
    const client = new FakeBackendClient();
    const aborted = new AbortController();
    aborted.abort();

    await expect(
      client.launch_session({ sport: "football", source: "manual" }, aborted.signal)
    ).rejects.toThrow();
    await expect(client.get_active_snapshot()).rejects.toThrow("No active session");

    const launched = await client.launch_session({ sport: "football", source: "manual" });
    const subscription = new AbortController();
    client.subscribe(launched.session.session_id, () => undefined, () => undefined, subscription.signal);
    subscription.abort();
    expect(client.active_subscription_count).toBe(0);
  });

  test("restores the active development session and appearance from storage", async () => {
    const storage = memory_storage();
    const first = new FakeBackendClient(storage);
    const launched = await first.launch_session({ sport: "football", source: "manual" });
    const updated = await first.submit_manual_transition({
      session_id: launched.session.session_id,
      expected_revision: launched.scoreboard.revision,
      fields: { ...launched.scoreboard.fields, home_score: 17 }
    });
    const appearance = await first.load_appearance("football");
    appearance.profiles[0]!.display_name = "Blue Devils";
    await first.save_appearance(appearance);

    const restored = new FakeBackendClient(storage);
    await expect(restored.get_active_snapshot()).resolves.toEqual(updated);
    expect((await restored.load_appearance("football")).profiles[0]?.display_name).toBe(
      "Blue Devils"
    );

    await restored.stop_session();
    await expect(new FakeBackendClient(storage).get_active_snapshot()).rejects.toThrow(
      "No active session"
    );
  });
});
