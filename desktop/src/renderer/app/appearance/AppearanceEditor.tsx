import { useEffect, useRef, useState } from "react";
import type { AppearancePayload, SessionSnapshot, TeamProfile } from "../../domain/session";
import { ScoreboardRenderer } from "../../scoreboard/ScoreboardRenderer";
import { sport_svgs } from "../../scoreboard/sport_svgs";
import { use_session } from "../../state/SessionProvider";
import { get_sport } from "../../sports/registry";
import { appearance_payload_schema } from "./appearance_schemas";
import { apply_appearance } from "./apply_appearance";
import styles from "./AppearanceEditor.module.css";

function StagingPreview({ snapshot, draft }: { snapshot: SessionSnapshot; draft: AppearancePayload }) {
  const container_ref = useRef<HTMLDivElement>(null);
  const renderer_ref = useRef<ScoreboardRenderer | null>(null);

  useEffect(() => {
    const host = document.createElement("div");
    const renderer = new ScoreboardRenderer(host);
    const sport = get_sport(snapshot.session.sport);
    renderer.mount(sport_svgs[snapshot.session.sport], sport.bindings);
    renderer.render(sport.derive_view(sport.score_schema.parse(snapshot.scoreboard.fields)));
    container_ref.current?.replaceChildren(host);
    renderer_ref.current = renderer;
    return () => renderer.dispose();
  }, [snapshot.session.sport]);

  useEffect(() => {
    if (renderer_ref.current !== null) apply_appearance(renderer_ref.current.shadowRoot, draft);
  }, [draft]);

  return <div className={styles.stagingPreview} ref={container_ref} />;
}

export interface AppearanceEditorProps {
  snapshot: SessionSnapshot;
  on_close(): void;
  on_apply(payload: AppearancePayload): void;
}

export function AppearanceEditor({ snapshot, on_close, on_apply }: AppearanceEditorProps) {
  const session = use_session();
  const [draft, set_draft] = useState<AppearancePayload | null>(null);
  const [error, set_error] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void session.load_appearance(snapshot.session.sport).then((payload) => {
      if (active) set_draft(structuredClone(payload));
    }).catch((reason: unknown) => {
      if (active) set_error(reason instanceof Error ? reason.message : "Unable to load appearance");
    });
    return () => { active = false; };
  }, [session.load_appearance, snapshot.session.sport]);

  const update_profile = (id: string, key: keyof TeamProfile, value: string): void => {
    set_draft((current) => current === null ? current : {
      ...current,
      profiles: current.profiles.map((profile) => profile.id === id ? { ...profile, [key]: value } : profile)
    });
  };

  const apply = async (): Promise<void> => {
    if (draft === null) return;
    set_error(null);
    try {
      const validated = appearance_payload_schema.parse(draft) as AppearancePayload;
      const saved = await session.save_appearance(validated);
      on_apply(saved);
      on_close();
    } catch (reason) {
      set_error(reason instanceof Error ? reason.message : "Unable to apply appearance");
    }
  };

  const home = draft?.profiles.find((profile) => profile.id === draft.appearance.home_profile_id);
  const away = draft?.profiles.find((profile) => profile.id === draft.appearance.away_profile_id);

  return (
    <div className={styles.backdrop} role="dialog" aria-label="Appearance settings" aria-modal="true">
      <section className={styles.editor}>
        <header><div><span>Preview</span><h2>Appearance settings</h2></div><button aria-label="Close appearance settings" onClick={on_close}>×</button></header>
        {draft === null || home === undefined || away === undefined ? (
          <p>{error ?? "Loading appearance…"}</p>
        ) : (
          <>
            <StagingPreview snapshot={snapshot} draft={draft} />
            <div className={styles.profileGrid}>
              {([["Home", home], ["Away", away]] as const).map(([side, profile]) => (
                <fieldset key={profile.id}>
                  <legend>{side} team</legend>
                  <label>{side} name<input aria-label={`${side} name`} value={profile.display_name} onChange={(event) => update_profile(profile.id, "display_name", event.target.value)} /></label>
                  <label>{side} abbreviation<input aria-label={`${side} abbreviation`} value={profile.abbreviation} onChange={(event) => update_profile(profile.id, "abbreviation", event.target.value)} /></label>
                  {(["light", "dark", "text"] as const).map((key) => (
                    <label key={key}>{side} {key} color<input aria-label={`${side} ${key} color`} type="color" value={profile[key]} onChange={(event) => update_profile(profile.id, key, event.target.value)} /></label>
                  ))}
                </fieldset>
              ))}
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <footer><button onClick={on_close}>Cancel</button><button className={styles.applyButton} onClick={() => void apply()}>Apply to broadcast</button></footer>
          </>
        )}
      </section>
    </div>
  );
}
