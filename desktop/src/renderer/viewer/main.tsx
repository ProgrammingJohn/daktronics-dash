import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { SessionSnapshot } from "../domain/session";
import { football_live } from "../sports/football/fixtures";
import { FakeSnapshotSource } from "./fake_snapshot_source";
import { Viewer } from "./Viewer";

const recorded_snapshot: SessionSnapshot = {
  session: {
    session_id: "review-football",
    sport: "football",
    source: "synced",
    control_authority: "daktronics"
  },
  connection: {
    status: "live",
    backend_status: "recorded fixture",
    last_update_at: "2026-08-08T16:00:00.000Z",
    source_age_ms: 0,
    message: null
  },
  scoreboard: {
    revision: 1,
    fields: football_live
  }
};

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");

createRoot(root).render(
  <StrictMode>
    <Viewer source={new FakeSnapshotSource(recorded_snapshot)} />
  </StrictMode>
);
