import { session_snapshot_schema } from "../domain/session";
import type { SnapshotSource } from "../viewer/snapshot_source";
import type { BackendClient } from "./BackendClient";

export class BackendSnapshotSource implements SnapshotSource {
  constructor(private readonly client: BackendClient) {}

  subscribe(
    signal: AbortSignal,
    on_snapshot: (snapshot: unknown) => void,
    on_error: (error: Error) => void
  ): void {
    if (signal.aborted) return;

    void this.client
      .get_active_snapshot(signal)
      .then((initial) => {
        if (signal.aborted) return;
        const snapshot = session_snapshot_schema.parse(initial);
        on_snapshot(snapshot);

        this.client.subscribe(
          snapshot.session.session_id,
          (candidate) => {
            try {
              on_snapshot(session_snapshot_schema.parse(candidate));
            } catch (error) {
              on_error(error instanceof Error ? error : new Error("Invalid snapshot"));
            }
          },
          on_error,
          signal
        );

        const heartbeat = window.setInterval(() => {
          void this.client
            .record_viewer_heartbeat(snapshot.session.session_id, signal)
            .catch((error: unknown) => {
              if (!signal.aborted) {
                on_error(error instanceof Error ? error : new Error("Viewer heartbeat failed"));
              }
            });
        }, 1000);
        signal.addEventListener("abort", () => window.clearInterval(heartbeat), { once: true });
      })
      .catch((error: unknown) => {
        if (!signal.aborted) {
          on_error(error instanceof Error ? error : new Error("Snapshot subscription failed"));
        }
      });
  }
}
