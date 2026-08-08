import { afterEach, describe, expect, test, vi } from "vitest";
import {
  FlaskBackendClient,
  map_backend_status,
  normalize_backend_score
} from "./FlaskBackendClient";

function json_response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("FlaskBackendClient", () => {
  afterEach(() => vi.useRealTimers());

  test.each([
    ["LIVE", "live"],
    ["STALE_SOURCE", "stale"],
    ["WAITING_FOR_CLIENT", "stale"],
    ["DISCONNECTED", "disconnected"],
    ["INCOMPATIBLE", "disconnected"]
  ] as const)("maps %s to %s", (raw, expected) => {
    expect(map_backend_status(raw)).toBe(expected);
  });

  test("launches synced service with device identity and exposes transport health", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json_response({ message: "Started" }))
      .mockResolvedValueOnce(
        json_response({
          status: "STALE_SOURCE",
          transport: "tcp",
          source: "daktronics",
          revision: 0,
          source_age_ms: null
        })
      );
    const client = new FlaskBackendClient({ fetcher, storage: null });

    const snapshot = await client.launch_session({
      sport: "football",
      source: "synced",
      connection: { ip: "10.0.0.20", port: 1234, device_id: "wt32-test" }
    });

    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      scoreboard: "football",
      method: "synced",
      ip: "10.0.0.20",
      port: 1234,
      device_id: "wt32-test"
    });
    expect(snapshot.connection).toMatchObject({
      status: "stale",
      backend_status: "STALE_SOURCE",
      transport: "tcp",
      source: "daktronics",
      source_age_ms: null,
      message: null
    });
  });

  test("starts discovery with blank IP and exposes discovery progress", async () => {
    const discovery = {
      phase: "BROADCAST_PROBING",
      active: true,
      attempts: 2,
      method: null,
      requested_host: null,
      resolved_host: null
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json_response({ message: "Started" }))
      .mockResolvedValueOnce(
        json_response({
          status: "DISCONNECTED",
          transport: "tcp",
          source: "daktronics",
          revision: 0,
          source_age_ms: null,
          discovery
        })
      );
    const client = new FlaskBackendClient({ fetcher, storage: null });

    const snapshot = await client.launch_session({
      sport: "football",
      source: "synced",
      connection: { ip: "", port: 1234, device_id: "wt32-943cc63d1287" }
    });

    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      scoreboard: "football",
      method: "synced",
      ip: "",
      port: 1234,
      device_id: "wt32-943cc63d1287"
    });
    expect(snapshot.connection.discovery).toEqual(discovery);
  });

  test("retries discovery with exactly one start request per explicit action", async () => {
    const not_found = {
      phase: "NOT_FOUND",
      active: false,
      attempts: 3,
      method: null,
      requested_host: null,
      resolved_host: null
    };
    const probing = { ...not_found, phase: "PASSIVE_LOOKUP", active: true, attempts: 0 };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json_response({ message: "Started" }))
      .mockResolvedValueOnce(
        json_response({
          status: "DISCONNECTED", transport: "tcp", source: "daktronics",
          revision: 0, source_age_ms: null, discovery: not_found
        })
      )
      .mockResolvedValueOnce(json_response({ message: "Started" }))
      .mockResolvedValueOnce(
        json_response({
          status: "DISCONNECTED", transport: "tcp", source: "daktronics",
          revision: 0, source_age_ms: null, discovery: probing
        })
      );
    const client = new FlaskBackendClient({ fetcher, storage: null });
    await client.launch_session({
      sport: "football",
      source: "synced",
      connection: { ip: "", port: 1234, device_id: "wt32-943cc63d1287" }
    });

    const retried = await client.retry_sync();

    const start_requests = fetcher.mock.calls.filter(([input]) =>
      String(input).endsWith("/api/scoreboard-service/start")
    );
    expect(start_requests).toHaveLength(2);
    expect(retried.connection.discovery?.phase).toBe("PASSIVE_LOOKUP");
  });

  test("polls once for multiple subscribers and fetches changed revisions while disconnected", async () => {
    vi.useFakeTimers();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json_response({ message: "Started" }))
      .mockResolvedValueOnce(
        json_response({ status: "LIVE", transport: "tcp", source: "daktronics", revision: 0, source_age_ms: 10 })
      )
      .mockResolvedValueOnce(
        json_response({ status: "DISCONNECTED", transport: "tcp", source: "daktronics", revision: 1, source_age_ms: 900 })
      )
      .mockResolvedValueOnce(
        json_response({
          home_score: 14,
          away_score: 7,
          clock: { minutes: 10, seconds: 37 },
          period: 1,
          down: 1,
          yards_to_go: 10,
          home_timeouts: 3,
          away_timeouts: 3,
          home_possesion: true
        })
      )
      .mockResolvedValueOnce(
        json_response({ status: "DISCONNECTED", transport: "tcp", source: "daktronics", revision: 1, source_age_ms: 1900 })
      );
    const client = new FlaskBackendClient({ fetcher, storage: null });
    const launched = await client.launch_session({
      sport: "football",
      source: "synced",
      connection: { ip: "10.0.0.20", port: 1234, device_id: "wt32-test" }
    });
    const first: number[] = [];
    const second: number[] = [];
    const controller = new AbortController();
    client.subscribe(launched.session.session_id, (value) => first.push(Number(value.scoreboard.fields.home_score)), () => undefined, controller.signal);
    client.subscribe(launched.session.session_id, (value) => second.push(Number(value.scoreboard.fields.home_score)), () => undefined, controller.signal);

    await vi.advanceTimersByTimeAsync(1000);
    expect(first).toEqual([14]);
    expect(second).toEqual([14]);
    expect(fetcher).toHaveBeenCalledTimes(4);

    await vi.advanceTimersByTimeAsync(1000);
    expect(first.at(-1)).toBe(14);
    expect(fetcher).toHaveBeenCalledTimes(5);
    controller.abort();
  });

  test("surfaces backend 400 and 503 messages", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json_response({ error: "Device ID is required" }, 400));
    const client = new FlaskBackendClient({ fetcher, storage: null });

    await expect(
      client.launch_session({
        sport: "football",
        source: "synced",
        connection: { ip: "10.0.0.20", port: 1234, device_id: "" }
      })
    ).rejects.toThrow("Device ID is required");

    const unavailable = new FlaskBackendClient({
      storage: null,
      fetcher: vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          json_response({ error: "Previous scoreboard service did not stop" }, 503)
        )
    });
    await expect(
      unavailable.launch_session({ sport: "football", source: "manual" })
    ).rejects.toThrow("Previous scoreboard service did not stop");
  });

  test("loads the persisted Flask scoreboard title and gradient payload", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      json_response({
        message: null,
        data: {
          home_team_name: "DEVILS",
          home_team_light: "#336699",
          home_team_dark: "#112233",
          home_team_text: "#ffffff",
          away_team_name: "GUEST",
          away_team_light: "#dddddd",
          away_team_dark: "#333333",
          away_team_text: "#000000"
        }
      })
    );
    const client = new FlaskBackendClient({ fetcher, storage: null });

    const appearance = await client.load_appearance("football");
    expect(appearance.profiles[0]).toMatchObject({
      abbreviation: "DEVILS",
      light: "#336699",
      dark: "#112233"
    });
  });

  test("normalizes parser field shapes at the frontend boundary", () => {
    expect(
      normalize_backend_score("football", {
        home_score: 3,
        away_score: 9,
        clock: { minutes: 10, seconds: 37 },
        period: 1,
        down: 1,
        yards_to_go: 10,
        home_timeouts: 3,
        away_timeouts: 3,
        home_possesion: true
      })
    ).toMatchObject({ yards: 10, home_score: 3 });
    expect(
      normalize_backend_score("basketball", {
        home_score: 1,
        away_score: 2,
        clock: { minutes: 8, seconds: 5 },
        home_fouls: 0,
        away_fouls: 0,
        home_bonus: false,
        away_bonus: false,
        home_timeouts: 5,
        away_timeouts: 5,
        period: 1
      })
    ).toMatchObject({ clock: "8:05" });
  });
});
