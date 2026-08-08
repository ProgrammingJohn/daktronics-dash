import { useEffect, useRef, useState } from "react";
import {
  session_snapshot_schema,
  type ConnectionStatus,
  type SessionSnapshot,
} from "../domain/session";
import { ScoreboardRenderer } from "../scoreboard/ScoreboardRenderer";
import { sport_svgs } from "../scoreboard/sport_svgs";
import { get_sport } from "../sports/registry";
import type { SnapshotSource } from "./snapshot_source";
import "./viewer.css";

export interface ViewerProps {
  source: SnapshotSource;
}

export function Viewer({ source }: ViewerProps) {
  const container_ref = useRef<HTMLDivElement>(null);
  const last_snapshot_ref = useRef<SessionSnapshot | null>(null);
  const [status, set_status] = useState<ConnectionStatus>("disconnected");

  useEffect(() => {
    const controller = new AbortController();
    let current_renderer: ScoreboardRenderer | null = null;
    let current_identity: string | null = null;

    source.subscribe(
      controller.signal,
      (candidate) => {
        try {
          const snapshot = session_snapshot_schema.parse(candidate);
          const identity = `${snapshot.session.session_id}:${snapshot.session.sport}`;
          const last_snapshot = last_snapshot_ref.current;
          const last_identity = last_snapshot
            ? `${last_snapshot.session.session_id}:${last_snapshot.session.sport}`
            : null;
          if (
            last_snapshot !== null &&
            identity === last_identity &&
            snapshot.scoreboard.revision <= last_snapshot.scoreboard.revision
          ) {
            return;
          }

          const sport = get_sport(snapshot.session.sport);
          const score = sport.score_schema.parse(snapshot.scoreboard.fields);
          const view = sport.derive_view(score);

          if (identity !== current_identity) {
            const next_host = document.createElement("div");
            next_host.dataset.viewerScoreboardHost = "";
            const next_renderer = new ScoreboardRenderer(next_host);
            next_renderer.mount(sport_svgs[snapshot.session.sport], sport.bindings);
            next_renderer.render(view);

            current_renderer?.dispose();
            container_ref.current?.replaceChildren(next_host);
            current_renderer = next_renderer;
            current_identity = identity;
          } else {
            current_renderer?.render(view);
          }

          last_snapshot_ref.current = snapshot;
          set_status(snapshot.connection.status);
        } catch {
          set_status("disconnected");
        }
      },
      () => set_status("disconnected")
    );

    return () => {
      controller.abort();
      current_renderer?.dispose();
      last_snapshot_ref.current = null;
    };
  }, [source]);

  return (
    <main className="viewer">
      <div ref={container_ref} data-testid="scoreboard-container" />
      <output className="viewer__status" data-testid="viewer-status" aria-live="polite">
        {status}
      </output>
    </main>
  );
}
