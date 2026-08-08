# Operator Console Corrections Design

## Goal

Correct the demo console's session persistence, clock operation, SVG rendering, font loading, and appearance-editor crash while replacing the decorative dashboard styling with a conventional broadcast-control interface.

## Visual Direction

The console will resemble a traditional desktop utility rather than a marketing dashboard. It uses flat charcoal and neutral gray surfaces, thin borders, ordinary rectangular controls, compact typography, and predictable spacing. The school blue `rgb(43 101 173)` (`#2b65ad`) is the only accent and is limited to primary actions, selected controls, focus indicators, and active manual states.

The active console retains a straightforward two-column layout: the program preview and connection facts on the left, session actions and sport controls on the right. The launcher uses standard grouped radio controls. Remove radial gradients, checkerboard backgrounds, floating-card effects, oversized headings, glowing status pills, and decorative branding treatments. Connection state continues to use text plus restrained status color.

## Session Persistence

The fake development backend receives an optional storage adapter. The browser development entry supplies `window.localStorage`; unit tests remain isolated by omitting storage unless persistence is under test. Every accepted fake-backend mutation persists the active snapshot, retained synced snapshot, appearance payloads, timestamps, and next session number.

On provider mount, `get_active_snapshot()` restores and subscribes to a valid existing session. A missing session keeps the launcher idle. Generation checks ensure an asynchronous restore cannot overwrite a newly launched session. `Launch new session...` clears persisted active-session state through the existing stop operation. This is development behavior only; the future production adapter remains the persistence authority.

## Clock Operation

Basketball and football clock controls include `Start`, `Stop`, and `Set clock`. Starting creates exactly one cancellable one-second interval scoped to the mounted manual-control deck. Each tick derives a complete next sport state and submits it through the existing revisioned manual transition. The clock stops at `0:00`, during unmount, on authority loss, or when the session changes. Input edits remain staged until `Set clock` is pressed.

The interval serializes transitions so a slow update cannot create overlapping revision conflicts. Starting an already-running clock is a no-op; stopping an already-stopped clock is safe.

## SVG Colors and Fonts

Each canonical SVG declares default custom properties on its `svg` element instead of `:root`, making them available inside the renderer's ShadowRoot. The embedded font source uses `/fonts/LEMONMILK-Medium.otf`, while Vite serves and copies the existing `static/` directory as its public directory. The built viewer and operator therefore use a real OpenType response without duplicating the font asset.

Tests assert computed/default style tokens, successful font asset delivery/build output, and real ShadowRoot score mutations. The existing namespaced ID/reference behavior remains unchanged.

## Appearance Editor

The staging preview uses an imperatively-created child host, matching the stable program-preview pattern. React Strict Mode can dispose and recreate the renderer without attaching a second ShadowRoot to the same element. Loading, error, editor, and action states always render visible content. Cancel disposes staging and leaves live output unchanged; Apply validates and saves once before updating live output.

## Verification

Automated coverage will include:

- reload restoration and persisted stop behavior;
- Start/Stop countdown behavior, zero stop, and interval cleanup;
- actual score and clock text changes inside the SVG ShadowRoot;
- SVG default color tokens and font URL correctness;
- Strict Mode appearance-editor mounting;
- appearance staging isolation;
- full tests, typecheck, Vite build, XML validation, Python compilation, and parser smoke test.

A real-browser screenshot and interaction pass is required when the browser-control surface is available. If it remains unavailable, the local preview stays running and that manual visual check is reported explicitly rather than claimed.

## Boundaries

No production transmission adapter, Flask route, Python parser, or `transmission/` file changes are included. Electron packaging remains deferred until the transmission-agent handoff.
