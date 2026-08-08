import { describe, expect, test } from "vitest";
import type { SessionSnapshot } from "../domain/session";
import {
  initial_session_state,
  select_display_snapshot,
  session_reducer,
  type SessionState
} from "./session_reducer";

function football_snapshot(
  revision: number,
  home_score: number,
  authority: "daktronics" | "manual" = "daktronics"
): SessionSnapshot {
  return {
    session: {
      session_id: "football-session",
      sport: "football",
      source: "synced",
      control_authority: authority
    },
    connection: {
      status: "live",
      backend_status: "connected",
      last_update_at: "2026-08-08T16:00:00.000Z",
      source_age_ms: 20,
      message: null
    },
    scoreboard: { revision, fields: { home_score } }
  };
}

describe("session_reducer", () => {
  test("moves idle to launching to active and records launch failure", () => {
    const launching = session_reducer(initial_session_state, {
      type: "launch_requested",
      generation: 1
    });
    expect(launching.phase).toBe("launching");

    const active = session_reducer(launching, {
      type: "launch_succeeded",
      generation: 1,
      snapshot: football_snapshot(0, 0)
    });
    expect(active.phase).toBe("active");

    const failed = session_reducer(initial_session_state, {
      type: "launch_requested",
      generation: 2
    });
    expect(
      session_reducer(failed, { type: "launch_failed", generation: 2, error: "offline" })
        .last_error
    ).toBe("offline");
  });

  test("accepts only newer revisions for the active generation and session", () => {
    const active = {
      ...initial_session_state,
      phase: "active" as const,
      generation: 3,
      accepted: football_snapshot(1, 7)
    };
    const live = session_reducer(active, {
      type: "snapshot",
      generation: 3,
      snapshot: football_snapshot(2, 14)
    });
    const late = session_reducer(live, {
      type: "snapshot",
      generation: 3,
      snapshot: football_snapshot(1, 99)
    });
    const wrong_generation = session_reducer(live, {
      type: "snapshot",
      generation: 2,
      snapshot: football_snapshot(3, 21)
    });

    expect(late.accepted?.scoreboard.revision).toBe(2);
    expect(late.accepted?.scoreboard.fields.home_score).toBe(14);
    expect(wrong_generation).toBe(live);
  });

  test("marks connection failure without erasing the accepted scoreboard", () => {
    const active = {
      ...initial_session_state,
      phase: "active" as const,
      generation: 1,
      accepted: football_snapshot(4, 28)
    };
    const failed = session_reducer(active, {
      type: "connection_failed",
      generation: 1,
      error: "socket offline"
    });

    expect(failed.accepted?.connection.status).toBe("disconnected");
    expect(failed.accepted?.scoreboard.fields.home_score).toBe(28);
  });

  test("shows optimistic manual state, rolls back failure, and retains at most 20 undo states", () => {
    let state: SessionState = {
      ...initial_session_state,
      phase: "active" as const,
      generation: 1,
      accepted: football_snapshot(0, 0, "manual")
    };
    const optimistic = football_snapshot(1, 1, "manual");
    state = session_reducer(state, {
      type: "manual_optimistic",
      generation: 1,
      snapshot: optimistic
    });
    expect(select_display_snapshot(state)?.scoreboard.fields.home_score).toBe(1);

    state = session_reducer(state, {
      type: "manual_failed",
      generation: 1,
      error: "rejected"
    });
    expect(select_display_snapshot(state)?.scoreboard.fields.home_score).toBe(0);
    expect(state.undo_stack).toHaveLength(0);

    for (let revision = 1; revision <= 22; revision += 1) {
      state = session_reducer(state, {
        type: "manual_optimistic",
        generation: 1,
        snapshot: football_snapshot(revision, revision, "manual")
      });
      state = session_reducer(state, {
        type: "manual_succeeded",
        generation: 1,
        snapshot: football_snapshot(revision, revision, "manual")
      });
    }
    expect(state.undo_stack).toHaveLength(20);
  });

  test("returns to idle with a newer generation for a new session", () => {
    const active = {
      ...initial_session_state,
      phase: "active" as const,
      generation: 4,
      accepted: football_snapshot(2, 14)
    };
    const stopping = session_reducer(active, { type: "stop_requested", generation: 5 });
    const idle = session_reducer(stopping, { type: "new_session", generation: 5 });

    expect(stopping.phase).toBe("stopping");
    expect(stopping.accepted?.scoreboard.fields.home_score).toBe(14);
    expect(idle.phase).toBe("idle");
    expect(idle.accepted).toBeNull();
  });
});
