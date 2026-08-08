import type {
  AppearancePayload,
  LaunchSessionInput,
  ManualTransition,
  SessionCapabilities,
  SessionSnapshot,
  SportId
} from "../domain/session";

export interface BackendClient {
  list_capabilities(signal?: AbortSignal): Promise<readonly SessionCapabilities[]>;
  launch_session(input: LaunchSessionInput, signal?: AbortSignal): Promise<SessionSnapshot>;
  stop_session(signal?: AbortSignal): Promise<void>;
  get_active_snapshot(signal?: AbortSignal): Promise<SessionSnapshot>;
  subscribe(
    session_id: string,
    on_snapshot: (snapshot: SessionSnapshot) => void,
    on_error: (error: Error) => void,
    signal: AbortSignal
  ): void;
  take_manual_control(expected_revision: number, signal?: AbortSignal): Promise<SessionSnapshot>;
  return_to_sync(expected_revision: number, signal?: AbortSignal): Promise<SessionSnapshot>;
  retry_sync(signal?: AbortSignal): Promise<SessionSnapshot>;
  submit_manual_transition(
    transition: ManualTransition,
    signal?: AbortSignal
  ): Promise<SessionSnapshot>;
  load_appearance(sport: SportId, signal?: AbortSignal): Promise<AppearancePayload>;
  save_appearance(payload: AppearancePayload, signal?: AbortSignal): Promise<AppearancePayload>;
  record_viewer_heartbeat(session_id: string, signal?: AbortSignal): Promise<void>;
}
