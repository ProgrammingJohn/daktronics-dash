# Operator Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the session launcher, monitoring-first console, manual fallback controls, and isolated appearance editor on top of the rendering foundation.

**Architecture:** React receives a `BackendClient` dependency, validates snapshots at the client boundary, and drives a reducer-owned session state machine. Sport manifests provide controls and appearance declarations; the operator console never calls transmission endpoints directly. Tests and development use a deterministic fake client until the separate backend handoff supplies the production adapter.

**Tech Stack:** React, strict TypeScript, Zod, native fetch/AbortController contracts, CSS Modules, Vitest, React Testing Library, and the rendering foundation from the preceding plan.

## Global Constraints

- Complete `2026-08-08-frontend-rendering-foundation.md` first.
- Do not modify `transmission/`, Python connection code, or parser code.
- Do not create a production transmission adapter in this phase; the user will provide a separate backend-integration prompt.
- Sport and transmission method are immutable for a running session.
- `Launch new session...` is the only route back to sport/source selection.
- Synced sessions are monitoring-first; manual controls mount only after confirmed takeover.
- Failed or stale responses never erase the last accepted state.
- No jQuery, router, global state library, Axios, component framework, or CSS-in-JS.

---

## File Map

- Create `desktop/src/renderer/api/BackendClient.ts`: frontend-facing backend operations.
- Create `desktop/src/renderer/api/FakeBackendClient.ts`: deterministic tests and development.
- Create `desktop/src/renderer/state/session_reducer.ts`: session lifecycle and revision gate.
- Create `desktop/src/renderer/state/SessionProvider.tsx`: dependency injection, subscription, and commands.
- Replace `desktop/src/renderer/app/App.tsx`: launch/console state selection.
- Create focused components under `app/launch/`, `app/console/`, `app/manual/`, and `app/appearance/`.
- Create `desktop/src/renderer/styles/tokens.css`: shared visual tokens.
- Add CSS Modules beside each component.

### Task 1: Backend Client Contract and Deterministic Fake

**Files:**
- Create: `desktop/src/renderer/api/BackendClient.ts`
- Create: `desktop/src/renderer/api/FakeBackendClient.ts`
- Create: `desktop/src/renderer/api/FakeBackendClient.test.ts`
- Create: `desktop/src/renderer/api/BackendSnapshotSource.ts`
- Create: `desktop/src/renderer/api/BackendSnapshotSource.test.ts`
- Modify: `desktop/src/renderer/domain/session.ts`

**Interfaces:**
- Consumes: `SportId`, `TransmissionSource`, and `SessionSnapshot`.
- Produces: `SessionCapabilities`, `LaunchSessionInput`, `ManualTransition`, `AppearancePayload`, `BackendClient`, and `FakeBackendClient`.

- [ ] **Step 1: Write fake-client contract tests**

Test capability listing, launch, monotonic revisions, takeover copying the last score, rejection of synced publication during manual authority, return-to-sync freshness, appearance persistence, viewer heartbeat, and abort behavior.

```ts
const client = new FakeBackendClient();
await client.launch_session({ sport: "football", source: "synced" });
client.publish_synced({ home_score: 14, away_score: 7 });
const manual = await client.take_manual_control();
expect(manual.session.control_authority).toBe("manual");
expect(manual.scoreboard.fields.home_score).toBe(14);
expect(() => client.publish_synced({ home_score: 21 })).toThrow("Manual authority blocks synced publication");
```

- [ ] **Step 2: Run the test and verify the missing-client failure**

Run: `cd desktop && npm test -- src/renderer/api/FakeBackendClient.test.ts`

Expected: FAIL importing the client modules.

- [ ] **Step 3: Define the exact frontend contract**

```ts
export interface BackendClient {
  list_capabilities(signal?: AbortSignal): Promise<readonly SessionCapabilities[]>;
  launch_session(input: LaunchSessionInput, signal?: AbortSignal): Promise<SessionSnapshot>;
  stop_session(signal?: AbortSignal): Promise<void>;
  get_active_snapshot(signal?: AbortSignal): Promise<SessionSnapshot>;
  subscribe(session_id: string, on_snapshot: (snapshot: SessionSnapshot) => void, on_error: (error: Error) => void, signal: AbortSignal): void;
  take_manual_control(expected_revision: number, signal?: AbortSignal): Promise<SessionSnapshot>;
  return_to_sync(expected_revision: number, signal?: AbortSignal): Promise<SessionSnapshot>;
  submit_manual_transition(transition: ManualTransition, signal?: AbortSignal): Promise<SessionSnapshot>;
  load_appearance(sport: SportId, signal?: AbortSignal): Promise<AppearancePayload>;
  save_appearance(payload: AppearancePayload, signal?: AbortSignal): Promise<AppearancePayload>;
  record_viewer_heartbeat(session_id: string, signal?: AbortSignal): Promise<void>;
}
```

`ManualTransition` contains `session_id`, `expected_revision`, and a complete validated `fields` object. Every `SessionSnapshot.session` contains a non-empty `session_id`. `LaunchSessionInput` contains only `sport` and `source`; transmission-specific settings remain behind the later production adapter.

- [ ] **Step 4: Implement the fake as a real state machine**

Use one in-memory session, increment revisions on every accepted transition, deep-clone emitted fields, preserve the last valid synced snapshot during manual authority, and configure the fake's sync-freshness window to two seconds before `return_to_sync`. Every async method calls `signal?.throwIfAborted()` before mutation. Development capabilities list all three current sports with manual and synced support.

Implement `BackendSnapshotSource` from the rendering foundation's `SnapshotSource`: fetch the active snapshot, subscribe using its `session_id`, validate every callback, and send `record_viewer_heartbeat` once per second until its AbortSignal fires. Its tests use fake timers and prove the subscription and heartbeat interval are both disposed on abort.

- [ ] **Step 5: Verify and commit the client boundary**

Run: `cd desktop && npm test -- src/renderer/api && npm run typecheck`

Expected: all API tests pass and type checking exits 0.

```bash
git add desktop/src/renderer/api desktop/src/renderer/domain/session.ts
git commit -m "Define operator backend client boundary"
```

### Task 2: Session Reducer and Disposable Provider

**Files:**
- Create: `desktop/src/renderer/state/session_reducer.ts`
- Create: `desktop/src/renderer/state/session_reducer.test.ts`
- Create: `desktop/src/renderer/state/SessionProvider.tsx`
- Create: `desktop/src/renderer/state/SessionProvider.test.tsx`

**Interfaces:**
- Consumes: `BackendClient` and validated `SessionSnapshot`.
- Produces: `SessionState`, `session_reducer`, `SessionProvider`, and `use_session()` commands.

- [ ] **Step 1: Write reducer transition tests**

Cover `idle → launching → active`, rejected launch, newer revision acceptance, duplicate/late revision rejection, stale/disconnected retention, takeover, manual optimistic transition, manual rejection rollback, return to sync, and `newSession → idle`.

```ts
const live = session_reducer(active_state, { type: "snapshot", snapshot: revision_two });
const late = session_reducer(live, { type: "snapshot", snapshot: revision_one });
expect(late.accepted?.scoreboard.revision).toBe(2);
expect(late.accepted?.scoreboard.fields).toEqual(revision_two.scoreboard.fields);
```

- [ ] **Step 2: Run tests and verify missing reducer/provider failures**

Run: `cd desktop && npm test -- src/renderer/state`

Expected: FAIL importing the new modules.

- [ ] **Step 3: Implement a discriminated session state**

Use `phase: "idle" | "launching" | "active" | "stopping"`, keep `accepted`, `optimistic`, `last_error`, `undo_stack`, and one monotonically increasing frontend `generation`. Snapshot actions include generation; mismatched generations are ignored. Keep at most 20 accepted manual states in `undo_stack`.

- [ ] **Step 4: Implement provider commands with one AbortController per generation**

`SessionProvider` owns `launch`, `launch_new_session`, `take_manual_control`, `return_to_sync`, `transition`, and `undo`. Launch aborts the prior generation, validates the returned snapshot, then subscribes. New-session confirmation is a UI concern, but the provider freezes `accepted` while stopping. Component unmount aborts the active subscription. Manual failure dispatches rollback and retains OBS-visible accepted state.

- [ ] **Step 5: Verify cleanup and commit**

Run: `cd desktop && npm test -- src/renderer/state && npm run typecheck`

Expected: reducer tests pass and provider unmount makes the fake client observe an aborted signal.

```bash
git add desktop/src/renderer/state
git commit -m "Add disposable operator session state"
```

### Task 3: Session Launcher and Monitoring Console

**Files:**
- Replace: `desktop/src/renderer/app/App.tsx`
- Modify: `desktop/src/renderer/main.tsx`
- Create: `desktop/src/renderer/app/launch/SessionLauncher.tsx`
- Create: `desktop/src/renderer/app/launch/SessionLauncher.test.tsx`
- Create: `desktop/src/renderer/app/launch/SessionLauncher.module.css`
- Create: `desktop/src/renderer/app/console/OperatorConsole.tsx`
- Create: `desktop/src/renderer/app/console/OperatorConsole.test.tsx`
- Create: `desktop/src/renderer/app/console/ConnectionBadge.tsx`
- Create: `desktop/src/renderer/app/console/ProgramPreview.tsx`
- Create: `desktop/src/renderer/app/console/OperatorConsole.module.css`
- Create: `desktop/src/renderer/styles/tokens.css`

**Interfaces:**
- Consumes: `use_session()`, sport registry, and `ScoreboardRenderer`.
- Produces: explicit session selection, read-only session badges, monitoring-first console, and confirmed new-session flow.

- [ ] **Step 1: Write operator-flow component tests**

Assert that sport cards expose only supported sources, launch is explicit, active sport/source render as text rather than controls, connection badges contain text as well as color, synced mode hides manual controls, and `Launch new session...` requires confirmation.

```tsx
render_operator({ sport: "football", source: "synced", status: "stale" });
expect(screen.getByText("Football")).toBeVisible();
expect(screen.getByText("Daktronics Sync")).toBeVisible();
expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
expect(screen.getByText("STALE")).toBeVisible();
expect(screen.getByRole("button", { name: "Take manual control…" })).toBeVisible();
```

- [ ] **Step 2: Run focused component tests and verify failures**

Run: `cd desktop && npm test -- src/renderer/app/launch src/renderer/app/console`

Expected: FAIL importing launcher and console components.

- [ ] **Step 3: Build the launcher and immutable session identity UI**

Render accessible radio-card groups for sport and source, preselect the last fake-client choice, and disable launch until valid. Manual-only capability data automatically selects manual and explains the unavailable sync option. Do not render in-session dropdowns.

- [ ] **Step 4: Build the adaptive two-column console**

The primary column contains the shared program preview and compact connection metrics. The secondary column contains recent status, `Take manual control...`, `Connection details`, `Appearance settings`, and `Launch new session...`. Show source age using backend data; do not derive transport thresholds in the browser. Use green, amber, and red tokens with icon and text labels.

- [ ] **Step 5: Verify responsive and accessible behavior, then commit**

Run: `cd desktop && npm test -- src/renderer/app && npm run typecheck && npm run build`

Expected: component tests pass, type checking exits 0, and the build succeeds.

Manually check 1280×720 and 1920×1080, keyboard traversal, visible focus, and live/stale/disconnected fixtures.

```bash
git add desktop/src/renderer/app desktop/src/renderer/styles desktop/src/renderer/main.tsx
git commit -m "Add adaptive operator console"
```

### Task 4: Sport-Driven Manual Controls and Fallback

**Files:**
- Create: `desktop/src/renderer/app/manual/ManualControlDeck.tsx`
- Create: `desktop/src/renderer/app/manual/ManualControlDeck.test.tsx`
- Create: `desktop/src/renderer/app/manual/ManualControlDeck.module.css`
- Create: `desktop/src/renderer/app/manual/ControlField.tsx`
- Create: `desktop/src/renderer/app/manual/use_sport_shortcuts.ts`
- Create: `desktop/src/renderer/app/manual/use_sport_shortcuts.test.tsx`
- Modify: each `desktop/src/renderer/sports/<sport>/module.ts`
- Modify: `desktop/src/renderer/app/console/OperatorConsole.tsx`

**Interfaces:**
- Consumes: sport `ControlDefinition[]` and session-provider commands.
- Produces: generic sport controls, atomic manual transitions, shortcut cleanup, takeover/return confirmation, and undo.

- [ ] **Step 1: Write controls, clock commit, shortcut, and authority tests**

Assert that manual-only sessions mount controls immediately; synced sessions do not; takeover copies current values; score buttons submit complete state; clock inputs submit nothing until `Set clock`; undo resubmits the prior accepted state; shortcuts do not fire in inputs; and unmount removes shortcut behavior.

- [ ] **Step 2: Run manual tests and verify missing-component failures**

Run: `cd desktop && npm test -- src/renderer/app/manual`

Expected: FAIL importing the manual control components and hook.

- [ ] **Step 3: Define complete sport control metadata**

Use control kinds `counter`, `toggle`, `choice`, `clock`, and `action`. Every definition includes label, field key, bounds or options, optional shortcut, and a pure reducer `(score, input) => next_score`. Baseball rules for count/outs/inning transitions, basketball clock/fouls/bonus/timeouts, and football clock/down/distance/possession/timeouts live in their sport modules and return complete validated states.

- [ ] **Step 4: Implement generic controls and scoped shortcuts**

`use_sport_shortcuts` registers one window listener with an AbortController, ignores events whose target is `INPUT`, `SELECT`, `TEXTAREA`, or content-editable, and invokes only the active module's shortcut map. Buttons flash a shared pressed state for mouse and keyboard. Takeover and return-to-sync use confirmation dialogs; return is disabled unless the client reports a fresh synced snapshot.

- [ ] **Step 5: Verify all manual sports and commit**

Run: `cd desktop && npm test -- src/renderer/app/manual src/renderer/sports src/renderer/state && npm run typecheck`

Expected: all manual and lifecycle tests pass.

Manually operate every sport with mouse and keyboard and confirm only the active sport responds.

```bash
git add desktop/src/renderer/app/manual desktop/src/renderer/app/console desktop/src/renderer/sports
git commit -m "Add sport-driven manual fallback controls"
```

### Task 5: Staged Appearance Editor and Team Profiles

**Files:**
- Create: `desktop/src/renderer/app/appearance/AppearanceEditor.tsx`
- Create: `desktop/src/renderer/app/appearance/AppearanceEditor.test.tsx`
- Create: `desktop/src/renderer/app/appearance/AppearanceEditor.module.css`
- Create: `desktop/src/renderer/app/appearance/appearance_schemas.ts`
- Create: `desktop/src/renderer/app/appearance/profile_migration.ts`
- Create: `desktop/src/renderer/app/appearance/profile_migration.test.ts`
- Modify: `desktop/src/renderer/app/console/OperatorConsole.tsx`
- Modify: each sport module's appearance declaration.

**Interfaces:**
- Consumes: `AppearancePayload`, sport appearance declarations, and independent `ScoreboardRenderer` instances.
- Produces: reusable team profiles, per-sport settings, current-preference migration, staging/cancel/apply behavior.

- [ ] **Step 1: Write migration and staging-isolation tests**

Given the current `scoreboard_preferences.json` shape, assert that migration creates reusable home/away profiles plus sport appearance references without changing names or colors. Mount live and staging renderers together, edit staging, cancel, and assert live is unchanged. Apply once and assert one complete save payload plus one live refresh.

- [ ] **Step 2: Run tests and verify missing modules**

Run: `cd desktop && npm test -- src/renderer/app/appearance`

Expected: FAIL importing appearance schemas, migration, and editor.

- [ ] **Step 3: Implement versioned appearance schemas and migration**

Define schema version `1`, `TeamProfile { id, display_name, abbreviation, light, dark, text }`, and `SportAppearance { sport, home_profile_id, away_profile_id, token_overrides }`. Validate colors with `^#[0-9a-fA-F]{6}$`. Derive deterministic migrated IDs from sport and side so rerunning migration produces identical data.

- [ ] **Step 4: Implement editor-owned staging state**

Generate controls only from the active sport's declared tokens. Create a separate staging renderer and never pass its draft to the session provider. `Cancel` disposes staging and drops the draft. `Apply to broadcast` validates, calls `save_appearance` once, then updates the active renderer with the accepted payload. Invalid bindings or payloads leave live state unchanged and show an inline error.

- [ ] **Step 5: Run the complete console phase gate and commit**

Run:

```bash
cd desktop
npm test
npm run typecheck
npm run build
```

Expected: every test passes, type checking exits 0, and both operator/viewer entries build.

Manually verify appearance staging with two simultaneous renderers for every sport.

```bash
git add desktop/src/renderer/app/appearance desktop/src/renderer/app/console desktop/src/renderer/sports
git commit -m "Add isolated scoreboard appearance editor"
```

## Phase Acceptance

- Operators explicitly launch a sport and source; the active session exposes no switching dropdown.
- Synced operation is monitor-first with confirmed manual takeover and return.
- Manual-only operation mounts the correct sport controls immediately.
- Session generation, revision checks, aborts, and unmount cleanup prevent stale updates and leaked behavior.
- Appearance editing uses an isolated staging renderer and applies one complete payload.
- The complete console can be demonstrated against `FakeBackendClient` without changing transmission code.
- The production backend adapter remains intentionally outside this phase pending the user's integration prompt.
