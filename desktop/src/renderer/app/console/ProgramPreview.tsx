import { useEffect, useRef, useState } from "react";
import type { AppearancePayload, SessionSnapshot } from "../../domain/session";
import { ScoreboardRenderer } from "../../scoreboard/ScoreboardRenderer";
import { sport_svgs } from "../../scoreboard/sport_svgs";
import { get_sport } from "../../sports/registry";
import { apply_appearance } from "../appearance/apply_appearance";
import styles from "./OperatorConsole.module.css";

export function ProgramPreview({ snapshot, appearance }: { snapshot: SessionSnapshot; appearance?: AppearancePayload }) {
  const container_ref = useRef<HTMLDivElement>(null);
  const renderer_ref = useRef<ScoreboardRenderer | null>(null);
  const [error, set_error] = useState<string | null>(null);
  const [copied, set_copied] = useState(false);
  const identity = `${snapshot.session.session_id}:${snapshot.session.sport}`;
  const viewer_url = new URL("/viewer", window.location.origin).toString();

  useEffect(() => {
    const host = document.createElement("div");
    host.className = styles.scoreboardHost ?? "";
    host.style.height = "300px";
    host.style.overflow = "hidden";
    const renderer = new ScoreboardRenderer(host);
    renderer.mount(sport_svgs[snapshot.session.sport], get_sport(snapshot.session.sport).bindings);
    container_ref.current?.replaceChildren(host);
    renderer_ref.current = renderer;
    set_error(null);

    return () => {
      renderer.dispose();
      if (renderer_ref.current === renderer) renderer_ref.current = null;
    };
  }, [identity, snapshot.session.sport]);

  useEffect(() => {
    try {
      const sport = get_sport(snapshot.session.sport);
      const score = sport.score_schema.parse(snapshot.scoreboard.fields);
      renderer_ref.current?.render(sport.derive_view(score));
      if (appearance !== undefined && renderer_ref.current !== null) {
        apply_appearance(renderer_ref.current.shadowRoot, appearance);
      }
      set_error(null);
    } catch (reason) {
      set_error(reason instanceof Error ? reason.message : "Preview unavailable");
    }
  }, [snapshot, appearance]);

  const copy_viewer_url = (): void => {
    void navigator.clipboard.writeText(viewer_url).then(() => {
      set_copied(true);
      window.setTimeout(() => set_copied(false), 1800);
    }).catch(() => set_error("Could not copy the OBS viewer URL"));
  };

  return (
    <section className={styles.previewCard} aria-label="Program preview">
      <div className={styles.previewHeader}>
        <div>
          <span className={styles.sectionLabel}>Program</span>
          <h2>OBS output preview</h2>
        </div>
        <div className={styles.viewerUrl}>
          <input aria-label="OBS viewer URL" readOnly value={viewer_url} />
          <button type="button" onClick={copy_viewer_url} aria-label="Copy OBS URL">
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <div className={styles.previewStage} ref={container_ref} />
      {error && <p className={styles.inlineError}>{error}</p>}
    </section>
  );
}
