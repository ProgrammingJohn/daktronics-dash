import type { SessionSnapshot } from "../domain/session";

export type SessionPhase = "idle" | "launching" | "active" | "stopping";

export interface SessionState {
  phase: SessionPhase;
  generation: number;
  accepted: SessionSnapshot | null;
  optimistic: SessionSnapshot | null;
  last_error: string | null;
  undo_stack: readonly SessionSnapshot[];
}

export const initial_session_state: SessionState = {
  phase: "idle",
  generation: 0,
  accepted: null,
  optimistic: null,
  last_error: null,
  undo_stack: []
};

export type SessionAction =
  | { type: "launch_requested"; generation: number }
  | { type: "launch_succeeded"; generation: number; snapshot: SessionSnapshot }
  | { type: "launch_failed"; generation: number; error: string }
  | { type: "snapshot"; generation: number; snapshot: SessionSnapshot }
  | { type: "connection_failed"; generation: number; error: string }
  | { type: "manual_optimistic"; generation: number; snapshot: SessionSnapshot }
  | { type: "manual_succeeded"; generation: number; snapshot: SessionSnapshot }
  | { type: "manual_failed"; generation: number; error: string }
  | { type: "stop_requested"; generation: number }
  | { type: "new_session"; generation: number };

function generation_matches(state: SessionState, generation: number): boolean {
  return state.generation === generation;
}

function same_session(left: SessionSnapshot, right: SessionSnapshot): boolean {
  return (
    left.session.session_id === right.session.session_id &&
    left.session.sport === right.session.sport
  );
}

export function select_display_snapshot(state: SessionState): SessionSnapshot | null {
  return state.optimistic ?? state.accepted;
}

export function session_reducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "launch_requested":
      return {
        phase: "launching",
        generation: action.generation,
        accepted: null,
        optimistic: null,
        last_error: null,
        undo_stack: []
      };
    case "launch_succeeded":
      if (!generation_matches(state, action.generation)) return state;
      return {
        ...state,
        phase: "active",
        accepted: action.snapshot,
        optimistic: null,
        last_error: null
      };
    case "launch_failed":
      if (!generation_matches(state, action.generation)) return state;
      return { ...state, phase: "idle", last_error: action.error };
    case "snapshot": {
      if (!generation_matches(state, action.generation) || state.phase !== "active") return state;
      if (state.accepted === null) return { ...state, accepted: action.snapshot };
      if (!same_session(state.accepted, action.snapshot)) return state;
      if (action.snapshot.scoreboard.revision <= state.accepted.scoreboard.revision) return state;
      return {
        ...state,
        accepted: action.snapshot,
        optimistic: null,
        last_error: null
      };
    }
    case "connection_failed":
      if (!generation_matches(state, action.generation) || state.accepted === null) return state;
      return {
        ...state,
        accepted: {
          ...state.accepted,
          connection: {
            ...state.accepted.connection,
            status: "disconnected",
            message: action.error
          }
        },
        last_error: action.error
      };
    case "manual_optimistic": {
      if (!generation_matches(state, action.generation) || state.accepted === null) return state;
      const undo_stack = [...state.undo_stack, state.accepted].slice(-20);
      return {
        ...state,
        optimistic: action.snapshot,
        last_error: null,
        undo_stack
      };
    }
    case "manual_succeeded":
      if (!generation_matches(state, action.generation)) return state;
      if (
        state.accepted !== null &&
        action.snapshot.scoreboard.revision < state.accepted.scoreboard.revision
      ) {
        return state;
      }
      return {
        ...state,
        accepted: action.snapshot,
        optimistic: null,
        last_error: null
      };
    case "manual_failed":
      if (!generation_matches(state, action.generation)) return state;
      return {
        ...state,
        optimistic: null,
        last_error: action.error,
        undo_stack: state.undo_stack.slice(0, -1)
      };
    case "stop_requested":
      return {
        ...state,
        phase: "stopping",
        generation: action.generation,
        optimistic: null,
        last_error: null
      };
    case "new_session":
      if (!generation_matches(state, action.generation)) return state;
      return { ...initial_session_state, generation: action.generation };
  }
}
