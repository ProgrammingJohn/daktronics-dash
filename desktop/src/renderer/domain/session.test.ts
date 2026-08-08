import { describe, expect, it } from "vitest";
import { session_snapshot_schema } from "./session";

describe("session_snapshot_schema", () => {
  it("parses a valid normalized scoreboard snapshot", () => {
    const valid = session_snapshot_schema.parse({
      session: {
        session_id: "session-1",
        sport: "football",
        source: "synced",
        control_authority: "daktronics"
      },
      connection: {
        status: "live",
        backend_status: "LIVE",
        last_update_at: "2026-08-08T12:00:00Z",
        source_age_ms: 120,
        message: null
      },
      scoreboard: {
        revision: 4,
        fields: { home_score: 7 }
      }
    });

    expect(valid.scoreboard.revision).toBe(4);
  });

  it("rejects an unknown connection status", () => {
    const result = session_snapshot_schema.safeParse({
      session: {
        session_id: "session-1",
        sport: "football",
        source: "synced",
        control_authority: "daktronics"
      },
      connection: {
        status: "offline",
        backend_status: "OFFLINE",
        last_update_at: null,
        source_age_ms: null,
        message: "No connection"
      },
      scoreboard: {
        revision: 4,
        fields: {}
      }
    });

    expect(result.success).toBe(false);
  });

  it("rejects a negative scoreboard revision", () => {
    const result = session_snapshot_schema.safeParse({
      session: {
        session_id: "session-1",
        sport: "football",
        source: "synced",
        control_authority: "daktronics"
      },
      connection: {
        status: "live",
        backend_status: "LIVE",
        last_update_at: "2026-08-08T12:00:00Z",
        source_age_ms: 120,
        message: null
      },
      scoreboard: {
        revision: -1,
        fields: {}
      }
    });

    expect(result.success).toBe(false);
  });
});
