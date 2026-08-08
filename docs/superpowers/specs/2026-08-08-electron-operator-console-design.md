# DakDash Electron Operator Console Design

## Purpose

DakDash will become a bundleable Electron application centered on a live operator console. During a synced session, the operator primarily monitors Daktronics data and connection health. Manual control is available as an explicit fallback. Sports without a synced implementation run as manual sessions.

The application must continue serving a clean, stable localhost viewer for OBS on the same computer. Frontend work must remain independent of the separate transmission implementation until an explicit integration task is provided.

## Goals

- Package the operator UI and Python service as one desktop application.
- Keep the console open and useful throughout a game.
- Make connection state and data freshness immediately understandable.
- Support deliberate sport and transmission selection when launching a session.
- Support safe manual takeover during a synced session.
- Isolate every sport's controls, state, timers, keyboard handlers, and SVG rendering.
- Reuse the same rendering behavior in the operator preview and OBS viewer.
- Retain the last valid OBS output through stale data, disconnects, and failed session setup.
- Improve appearance editing without allowing staged changes to affect another sport or the live output.

## Non-Goals

- This project does not change ESP32 firmware, serial framing, TCP/UDP transport, discovery, or sport parsing in Python.
- This project does not replace the Python backend with Node.js.
- This project does not expose the viewer to other computers; OBS runs on the same Mac.
- Raw free-form SVG editing and arbitrary user-provided scripts are not supported.
- Auto-update, public distribution signing, and cross-platform installers are not part of the first implementation. The first package targets local macOS validation while retaining a cross-platform Electron structure.
- The first implementation does not add a router, Redux, Zustand, Axios, a component library, CSS-in-JS, or an SVG manipulation library.

## Current Problems

The current Flask/Jinja wizard renders every sport's manual controls into one document. Those templates repeat IDs such as `home_score`, `clock`, and `period`. Rendering functions then use global jQuery selectors such as `.svg-score svg` and `#home_team_name`. Timers, polling loops, click listeners, and document-level keyboard listeners do not have a consistent disposal lifecycle.

The OBS viewer imports wizard and manual-control modules, so rendering is coupled to setup and operator behavior. Returning through the wizard can attach handlers more than once. Hidden controls remain in the DOM, making the active sport a convention instead of a boundary.

Inline SVG introduces a second collision class. Internal SVG IDs for gradients, clip paths, and filters can conflict when a live renderer and staging renderer display the same or different sports in one document. Scoping query selectors alone does not prevent fragment references such as `url(#paint0)` from resolving to the wrong definition, and embedded SVG style rules can leak beyond their intended instance.

## Product Model

### Session Identity

A session is created from two deliberate choices:

- sport, such as football, basketball, or baseball;
- transmission method, either Daktronics sync or manual operation.

Sport and transmission method are immutable session identity. The console displays them as read-only labels, not dropdowns. This prevents an accidental selection change from disrupting a live broadcast.

`Launch new session...` is a separate action. It requires confirmation, freezes the viewer on its last valid frame, stops the current session, disposes its operator-side resources, and returns to sport/source selection. The OBS URL remains unchanged. The frozen graphic remains visible until the new sport module, theme, and first valid state are ready; only then does the viewer dispose the old renderer and swap atomically.

### Control Authority

Control authority is separate from transmission method:

- A manual session begins with manual authority.
- A synced session begins with Daktronics authority.
- `Take manual control...` copies the latest valid synced values into manual state and prevents further synced values from overwriting the scoreboard.
- The backend may continue observing connection health while manual authority is active.
- `Return to synced feed...` is available only when a fresh synced snapshot exists and requires confirmation.

Manual takeover does not create a new session and cannot change the sport.

### Initial and New-Session Flow

The launch screen presents sport cards and the transmission methods supported by the selected sport. Recent selections may be preselected, but the operator must explicitly launch the session. Manual-only sports select manual operation automatically and explain why sync is unavailable.

Launching performs these steps:

1. When replacing a session, confirm the action, freeze the viewer's last valid frame, stop the old backend session, and dispose its operator controls, requests, shortcuts, and timers.
2. Validate the newly selected sport, transmission method, and required connection settings.
3. Load the new sport manifest, SVG, saved appearance, and initial state in a staging context.
4. Ask the backend client to start the new session.
5. Wait for a valid session response.
6. Mount the new console, atomically replace the viewer renderer, and resume live updates.

If any step fails, the application reports the failure without blanking the existing OBS output.

## Operator Experience

### Persistent Console

The console uses an adaptive two-column workspace:

- The primary area contains the program preview, sport/source labels, current game state, and compact diagnostics.
- The secondary area contains connection events and context-sensitive actions.
- Appearance, connection details, keyboard shortcuts, and logs open in drawers or dialogs rather than replacing the console.

The preview remains in the same position as the session changes between synced monitoring and manual fallback.

### Synced Monitoring

Synced mode emphasizes:

- `LIVE`, `STALE`, or `DISCONNECTED` health;
- age of the latest valid update;
- whether the serial relay, backend session, and OBS viewer are healthy;
- the latest parsed game values;
- recent meaningful events; and
- the `Take manual control...` fallback action.

Manual controls stay collapsed so monitoring remains calm and accidental edits are unlikely.

### Manual Operation

Manual-only sessions open the sport control deck immediately. A synced session opens the same controls after takeover.

- Single actions such as score, timeout, possession, inning, and period changes update the preview and OBS immediately.
- Multi-value input such as setting a clock uses an explicit commit action so partially typed values never reach OBS.
- `Undo last action` is available for manual state transitions.
- Keyboard shortcuts work only while the control deck is active and never while a text or numeric input is being edited.
- Mouse and keyboard actions show the same visible acknowledgement.
- Each sport supplies only the controls it supports.

A manual action derives and validates one complete next sport state, then submits it with the last accepted revision. The console may display that state optimistically. If the backend rejects it, the console reverts to the last accepted snapshot, OBS remains on the accepted state, and the operator receives an actionable error. Undo submits the previous accepted state as a new transition rather than editing browser DOM directly.

### OBS Viewer

OBS continues to load a stable localhost URL, initially `http://127.0.0.1:5000/viewer`. The viewer contains no Electron APIs, setup UI, operator controls, or manual event handlers. It consumes the same normalized state and sport rendering module as the console preview.

The viewer retains the last valid frame through API errors and backend restarts. A new session replaces the displayed sport only after the next renderer is ready. The viewer sends a lightweight local heartbeat while loaded so the console can report `OBS viewer connected` based on recent evidence rather than assuming that a configured URL is open.

## Visual and Interaction Direction

The desktop application uses a restrained broadcast-control visual language:

- dark program-preview surface;
- light control workspace with clear grouping;
- green for live health, amber for stale/manual states, and red for disconnected or destructive actions;
- large numeric values and large hit targets for game controls;
- descriptive labels in addition to color;
- visible focus styles and complete keyboard navigation;
- no modal browser alerts;
- contextual error messages near the affected action plus a persistent diagnostic summary.

Sport and source appear as read-only session badges. `Launch new session...` is visually separated from in-game actions and requires confirmation.

## Frontend Architecture

### Technology Stack

- Electron provides the desktop shell and application lifecycle.
- Electron Forge creates the distributable.
- PyInstaller produces the standalone Python sidecar included in the Electron package.
- React provides component mounting, conditional UI, and cleanup lifecycles.
- Strict TypeScript defines session, sport, score, renderer, and backend contracts.
- Vite builds the operator and viewer renderer bundles.
- Vite runs independently from Electron Forge because Forge's Vite plugin is experimental.
- Zod validates backend JSON at the network boundary.
- Native `fetch` and `AbortController` implement HTTP calls and cancellation.
- CSS Modules isolate component styles.
- Vitest and React Testing Library test frontend logic and behavior.

Vite transpilation is paired with `tsc --noEmit` in validation commands. There is no frontend state library initially; a reducer and context hold operator state. A separate state library may be introduced only if measured complexity justifies it.

### Desktop Structure

New desktop/frontend code lives under `desktop/` so the existing Python and transmission trees remain clear:

```text
desktop/
  package.json
  forge.config.ts
  src/
    main/
      main.ts
      backend_process.ts
    preload/
      preload.ts
    renderer/
      app/
      api/
      components/
      scoreboard/
      sports/
        baseball/
        basketball/
        football/
      state/
      styles/
      viewer/
  tests/
```

Vite produces separate operator and viewer entries. Production assets are included with the Python sidecar so Flask can serve the operator route and stable OBS viewer route. In development, Vite provides the renderer development server while API requests target the local Flask process.

### Electron Main Process

The Electron main process:

- enforces a single application instance;
- launches the packaged Python sidecar bound to `127.0.0.1`;
- waits for a DakDash health endpoint before opening the operator window;
- loads the operator route in a sandboxed BrowserWindow;
- reports startup failures and fixed-port conflicts clearly;
- records backend stdout/stderr in the application data directory; and
- requests graceful backend shutdown when Electron exits, with bounded forced termination only for the child process it created.

The renderer has `nodeIntegration` disabled, sandboxing enabled, and context isolation enabled. The preload surface remains minimal and exposes only native desktop actions that cannot be implemented safely in the browser.

The fixed localhost port preserves the OBS URL. If the port is occupied by another process, DakDash does not terminate or replace that process; it reports the conflict and provides recovery guidance.

Electron passes an application-data directory to the Python sidecar at startup. Team profiles, sport appearance, recent session choices, application preferences, and logs are stored there. Packaged application resources are treated as read-only, and no venue-specific address or operator setting is written back into the installed bundle.

## Backend Boundary

The frontend does not import or understand serial, TCP, UDP, discovery, framing, or parser implementation details. A backend client adapter owns the API surface and produces a normalized snapshot:

```ts
interface SessionSnapshot {
  session: {
    sport: SportId;
    source: "synced" | "manual";
    control_authority: "daktronics" | "manual";
  };
  connection: {
    status: "live" | "stale" | "disconnected";
    backend_status: string;
    last_update_at: string | null;
    source_age_ms: number | null;
    message: string | null;
  };
  scoreboard: {
    revision: number;
    fields: Record<string, unknown>;
  };
}
```

The adapter maps backend health states to the three primary UI states while preserving the original backend status as diagnostic detail. For example, `STALE_SOURCE` maps to `stale`; `WAITING_FOR_CLIENT`, `DISCONNECTED`, and `INCOMPATIBLE` map to `disconnected` with distinct messages.

The adapter exposes frontend operations rather than leaking endpoint details:

- list supported sports and sources;
- launch and stop a session;
- fetch the newest session snapshot;
- take and release manual authority;
- submit a complete manual transition;
- load, stage, and save appearance preferences; and
- read diagnostics.

When the separate transmission work is ready, an explicit integration task will map these operations to its real routes and canonical state. Transport changes must not require changes to React components, sport modules, or SVG bindings.

## State and Data Flow

```text
Python transmission/runtime
          ↓
  backend client adapter
          ↓ Zod validation
  normalized latest snapshot
          ↓ revision check
      session reducer
       ↙          ↘
operator UI    active sport module
                      ↓
             scoped SVG renderer
               ↙           ↘
        console preview   OBS viewer
```

The client accepts only validated snapshots with a newer revision for the current session. Late, duplicate, malformed, and superseded-session responses are discarded. Rendering uses the complete accepted snapshot, not a mixture of fields from multiple responses.

Polling remains encapsulated in the backend client for compatibility. Its cancellation is tied to the mounted session. A later WebSocket or server-sent-events implementation can replace polling without changing the state, sport, or rendering layers.

## Sport Modules

Each sport is an independently testable module registered by a manifest:

```ts
interface SportModule<TScore, TView> {
  id: SportId;
  display_name: string;
  supported_sources: readonly TransmissionSource[];
  score_schema: ZodSchema<TScore>;
  initial_score: TScore;
  derive_view(score: TScore): TView;
  bindings: readonly SvgBinding<TView>[];
  controls: readonly ControlDefinition<TScore>[];
  appearance: AppearanceDefinition;
}
```

Sport code owns sport-specific derivation such as basketball period labels, baseball inning text, football down-and-distance, timeout indicators, bonus visibility, and possession styling. Shared code owns session lifecycle, API transport, generic controls, appearance staging, and SVG mounting.

Only the active sport's controls are mounted. Launching a new session aborts its requests, stops its clock, removes its shortcuts, unmounts its React tree, and disposes its SVG renderer before another sport becomes active.

## SVG Rendering and Isolation

`ScoreboardRenderer` is a framework-independent class with one container and one SVG root. The console preview, appearance staging preview, and OBS viewer each receive separate instances.

Mounting an SVG performs these steps:

1. Parse the trusted bundled SVG asset.
2. Attach a renderer-owned ShadowRoot to isolate embedded SVG styles from the application and other renderer instances.
3. Generate a unique renderer prefix.
4. Rewrite every SVG `id` with that prefix.
5. Rewrite internal references, including `url(#...)`, `href`, `xlink:href`, clip paths, filters, masks, fills, strokes, and markers.
6. Attach the SVG inside the renderer's ShadowRoot.
7. Resolve the sport manifest's declared bindings only within that SVG root.
8. Report missing or duplicate semantic bindings before the renderer is eligible for broadcast.

Semantic elements use attributes such as `data-score-field="home_score"` rather than global document IDs. Internal SVG IDs remain implementation details and are always namespaced per instance. This prevents collisions even when live and staging previews contain the same sport simultaneously.

Bindings are typed operations such as text, attribute, visibility, and root style token. The renderer applies only declared bindings; it never iterates arbitrary API keys into selectors. At the current update rate and SVG size, it renders all declared bindings for an accepted revision rather than adding premature diffing complexity.

SVG templates are trusted application assets. If user-imported SVG is added in a future design, sanitization and a stricter import boundary are required before parsing or display.

## Appearance Editing

The appearance editor mounts a dedicated staging renderer. Edits affect only its root until the operator chooses `Apply to broadcast`.

Appearance data has two levels:

- reusable team profiles contain display name/abbreviation and brand colors;
- sport appearance contains sport-specific token overrides and references to the selected home and away profiles.

Each sport manifest declares the tokens it supports. The editor generates controls from that declaration instead of assuming that every SVG supports identical fields.

Applying validates the complete appearance payload, saves it as one update, and atomically refreshes the active console and viewer renderers. Cancel discards staging state. A missing SVG binding or invalid token prevents application and leaves the existing live renderer unchanged.

Existing per-sport preferences are migrated into sport appearance records and reusable team profiles during implementation. Migration preserves the current visible colors and names.

## Reliability and Error Handling

The console presents five operational situations through three primary connection labels and two authority modes:

- Connecting: themed initial preview while waiting for the first valid state.
- Live: green indicator and latest-update age.
- Stale: amber indicator while retaining the last valid scoreboard.
- Disconnected: red indicator, retained scoreboard, reconnect progress, and manual takeover when permitted.
- Manual authority: distinct operator-controlled indicator; sync cannot overwrite manual state.

Rules:

- Temporary API and transmission errors never blank the viewer.
- Malformed responses never replace the last valid snapshot with defaults.
- A session generation prevents an old request from publishing into a new session.
- Manual takeover starts from the latest accepted snapshot.
- Returning to sync requires a fresh backend snapshot.
- New-session failure leaves the previous graphic displayed.
- Connection thresholds and source freshness are determined by the backend; the frontend displays and maps the supplied health data.
- Non-blocking errors appear near their action, and diagnostics remain available for troubleshooting.

## Testing Strategy

### Unit Tests

- Backend schemas accept valid snapshots and reject malformed or incomplete data.
- Health mapping preserves backend diagnostic detail.
- Each sport derives the correct view model from canonical score fixtures.
- Every declared SVG binding exists in its sport asset.
- SVG ID namespacing rewrites definitions and every supported reference form.
- Renderer ShadowRoots prevent SVG style rules from leaking between previews or into the application UI.
- Two renderer instances cannot affect one another.
- Baseball state cannot update basketball or football elements.
- Manual transitions enforce bounds and support undo.
- Appearance validation accepts only declared tokens.

### Component and Integration Tests

- Launch selection shows only transmission methods supported by the sport.
- Session badges are read-only and new-session launch requires confirmation.
- Synced monitoring hides manual controls until takeover.
- Manual-only sports open their controls immediately.
- Taking manual authority starts from the latest synced values.
- Synced updates cannot overwrite manual authority.
- Returning to sync requires a fresh snapshot and confirmation.
- Switching sessions removes old keyboard listeners, polling, clock intervals, and renderers.
- Editing appearance changes staging only until apply.
- Live, stale, and disconnected states retain the last valid preview.
- The operator and viewer render the same accepted snapshot.

### Desktop and Manual Verification

- Electron starts the packaged Python sidecar, waits for health, and opens the console.
- A second Electron instance is rejected without starting another backend.
- Closing Electron shuts down only the child process it started.
- A fixed-port conflict produces recovery instructions and does not kill the occupying process.
- The packaged application works without internet access.
- OBS can load the stable viewer URL and retains its graphic across reconnects and session replacement.
- The console's OBS connection indicator follows actual viewer heartbeats and expires when the viewer closes.
- Each sport is exercised in manual mode; supported sports are also exercised in synced monitoring and fallback.
- Keyboard-only operation, focus visibility, color-independent statuses, and common window sizes are checked.

Validation commands will include TypeScript type checking, frontend unit/component tests, the existing Python compile check, the parser smoke check, and a packaged-app smoke test.

## Implementation Boundaries and Sequence

The frontend can be developed against a fake backend client and recorded sport snapshots without modifying transmission code. The eventual implementation plan should preserve these boundaries:

1. Establish Electron, React, TypeScript, Vite, and test scaffolding.
2. Build normalized schemas, fake backend client, reducer, and session lifecycle.
3. Build the SVG namespace/binding renderer and migrate each sport module with parity tests.
4. Build launch selection, adaptive console, manual controls, and appearance staging.
5. Build the standalone OBS viewer from the shared rendering layer.
6. Package and supervise the existing Python application as an Electron sidecar.
7. Integrate the separate transmission backend only after an explicit prompt supplies its final API contract.
8. Run per-sport, OBS, offline-package, session-switching, and recovery verification.

No step may modify files under `transmission/` as part of this frontend project.

## Acceptance Criteria

- A macOS Electron package launches DakDash without a separate terminal or browser setup.
- The operator can deliberately select a sport and supported transmission method and launch a session.
- Sport and source cannot be changed accidentally inside a running session.
- Synced sessions are monitoring-first and support confirmed manual takeover.
- Manual-only sessions expose complete sport-specific controls.
- The console always distinguishes live, stale, disconnected, and manual-authority operation.
- OBS uses one stable localhost URL and retains the last valid output through failures.
- Live, staging, and viewer SVG instances cannot conflict through selectors or internal IDs.
- Changing or launching one sport cannot leave another sport's listeners, timers, controls, state, or SVG mutations active.
- Appearance changes are isolated until atomically applied.
- The frontend depends only on a validated normalized backend adapter and does not couple to transmission internals.
- Automated and manual verification covers every supported sport and the packaged desktop lifecycle.
