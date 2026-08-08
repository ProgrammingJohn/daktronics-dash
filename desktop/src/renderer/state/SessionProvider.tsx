import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
  type ReactNode
} from "react";
import type { BackendClient } from "../api/BackendClient";
import {
  session_snapshot_schema,
  type LaunchSessionInput,
  type SessionCapabilities,
  type SessionSnapshot
} from "../domain/session";
import { get_sport } from "../sports/registry";
import {
  initial_session_state,
  session_reducer,
  type SessionState
} from "./session_reducer";

interface SessionContextValue {
  state: SessionState;
  capabilities: readonly SessionCapabilities[];
  launch(input: LaunchSessionInput): Promise<void>;
  launch_new_session(): Promise<void>;
  take_manual_control(): Promise<void>;
  return_to_sync(): Promise<void>;
  transition(fields: Record<string, unknown>): Promise<void>;
  undo(): Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function error_message(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown session error";
}

export interface SessionProviderProps {
  client: BackendClient;
  children: ReactNode;
}

export function SessionProvider({ client, children }: SessionProviderProps) {
  const [state, dispatch] = useReducer(session_reducer, initial_session_state);
  const [capabilities, set_capabilities] = useState<readonly SessionCapabilities[]>([]);
  const state_ref = useRef(state);
  const generation_ref = useRef(0);
  const active_controller_ref = useRef<AbortController | null>(null);
  state_ref.current = state;

  useEffect(() => {
    const controller = new AbortController();
    void client.list_capabilities(controller.signal).then(set_capabilities).catch(() => undefined);
    return () => controller.abort();
  }, [client]);

  useEffect(
    () => () => {
      active_controller_ref.current?.abort();
    },
    []
  );

  const subscribe = useCallback(
    (snapshot: SessionSnapshot, generation: number, controller: AbortController): void => {
      client.subscribe(
        snapshot.session.session_id,
        (candidate) => {
          try {
            dispatch({
              type: "snapshot",
              generation,
              snapshot: session_snapshot_schema.parse(candidate)
            });
          } catch (error) {
            dispatch({ type: "connection_failed", generation, error: error_message(error) });
          }
        },
        (error) => {
          dispatch({ type: "connection_failed", generation, error: error.message });
        },
        controller.signal
      );
    },
    [client]
  );

  const launch = useCallback(
    async (input: LaunchSessionInput): Promise<void> => {
      const generation = generation_ref.current + 1;
      generation_ref.current = generation;
      active_controller_ref.current?.abort();
      const controller = new AbortController();
      active_controller_ref.current = controller;
      dispatch({ type: "launch_requested", generation });

      try {
        const snapshot = session_snapshot_schema.parse(
          await client.launch_session(input, controller.signal)
        );
        dispatch({ type: "launch_succeeded", generation, snapshot });
        subscribe(snapshot, generation, controller);
      } catch (error) {
        if (!controller.signal.aborted) {
          dispatch({ type: "launch_failed", generation, error: error_message(error) });
        }
        throw error;
      }
    },
    [client, subscribe]
  );

  const launch_new_session = useCallback(async (): Promise<void> => {
    const generation = generation_ref.current + 1;
    generation_ref.current = generation;
    active_controller_ref.current?.abort();
    const controller = new AbortController();
    active_controller_ref.current = controller;
    dispatch({ type: "stop_requested", generation });
    await client.stop_session(controller.signal);
    dispatch({ type: "new_session", generation });
  }, [client]);

  const take_manual_control = useCallback(async (): Promise<void> => {
    const current = state_ref.current.accepted;
    if (current === null) throw new Error("No active session");
    const generation = state_ref.current.generation;
    const snapshot = session_snapshot_schema.parse(
      await client.take_manual_control(
        current.scoreboard.revision,
        active_controller_ref.current?.signal
      )
    );
    dispatch({ type: "snapshot", generation, snapshot });
  }, [client]);

  const return_to_sync = useCallback(async (): Promise<void> => {
    const current = state_ref.current.accepted;
    if (current === null) throw new Error("No active session");
    const generation = state_ref.current.generation;
    const snapshot = session_snapshot_schema.parse(
      await client.return_to_sync(current.scoreboard.revision, active_controller_ref.current?.signal)
    );
    dispatch({ type: "snapshot", generation, snapshot });
  }, [client]);

  const transition = useCallback(
    async (fields: Record<string, unknown>): Promise<void> => {
      const current = state_ref.current.accepted;
      if (current === null) throw new Error("No active session");
      if (current.session.control_authority !== "manual") {
        throw new Error("Manual authority is required");
      }
      const generation = state_ref.current.generation;
      const validated_fields = get_sport(current.session.sport).score_schema.parse(fields);
      const optimistic: SessionSnapshot = {
        ...structuredClone(current),
        scoreboard: {
          revision: current.scoreboard.revision + 1,
          fields: validated_fields
        }
      };
      dispatch({ type: "manual_optimistic", generation, snapshot: optimistic });

      try {
        const snapshot = session_snapshot_schema.parse(
          await client.submit_manual_transition(
            {
              session_id: current.session.session_id,
              expected_revision: current.scoreboard.revision,
              fields: validated_fields
            },
            active_controller_ref.current?.signal
          )
        );
        dispatch({ type: "manual_succeeded", generation, snapshot });
      } catch (error) {
        dispatch({ type: "manual_failed", generation, error: error_message(error) });
        throw error;
      }
    },
    [client]
  );

  const undo = useCallback(async (): Promise<void> => {
    const target = state_ref.current.undo_stack.at(-1);
    if (target === undefined) throw new Error("Nothing to undo");
    await transition(target.scoreboard.fields);
  }, [transition]);

  const value: SessionContextValue = {
    state,
    capabilities,
    launch,
    launch_new_session,
    take_manual_control,
    return_to_sync,
    transition,
    undo
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function use_session(): SessionContextValue {
  const value = useContext(SessionContext);
  if (value === null) throw new Error("use_session must be used inside SessionProvider");
  return value;
}
