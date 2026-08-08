# Operator Console Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix reload persistence, clock operation, SVG colors/fonts, and appearance staging while restyling the console as a conventional school-branded broadcast utility.

**Architecture:** The development fake persists through an injected storage adapter and the provider restores through the existing backend contract. Clock countdown is an isolated hook that serializes complete-state transitions. SVG defaults remain canonical assets, with Vite serving the existing font directory; UI changes are CSS-only except for stable renderer hosts.

**Tech Stack:** React, strict TypeScript, Zod, Shadow DOM/SVG, CSS Modules, Vitest, React Testing Library, Vite.

## Global Constraints

- Use `rgb(43 101 173)` / `#2b65ad` as the only UI accent.
- Keep production transmission integration deferred.
- Do not modify Python parsers or `transmission/`.
- Preserve sport/source immutability within a session.
- Validate real ShadowRoot text, SVG XML, color variables, and font responses.

---

### Task 1: Canonical SVG Colors and Font Assets

**Files:**
- Modify: `scoreboard_svgs/baseball.svg`
- Modify: `scoreboard_svgs/basketball.svg`
- Modify: `scoreboard_svgs/football.svg`
- Modify: `desktop/vite.config.ts`
- Create: `desktop/src/renderer/scoreboard/canonical_assets.test.ts`

**Interfaces:**
- Consumes: canonical raw SVG imports and repository `static/fonts/`.
- Produces: SVG-local default color tokens and `/fonts/LEMONMILK-Medium.otf` in dev/build output.

- [ ] Write tests that parse every SVG, assert the `svg` selector owns all six team variables, assert no SVG uses `:root`, mount/render each sport, and assert score text changes in its ShadowRoot.
- [ ] Run `cd desktop && npm test -- src/renderer/scoreboard/canonical_assets.test.ts`; expect failures on `:root` and font configuration.
- [ ] Change embedded CSS to `svg { --team tokens; font-family: Lemonmilk; }`, change the font URL to `/fonts/LEMONMILK-Medium.otf`, and set `publicDir: "../static"` in Vite.
- [ ] Run the focused tests, `npm run build`, `xmllint --noout ../scoreboard_svgs/*.svg`, and verify `dist/fonts/LEMONMILK-Medium.otf` is OpenType data.
- [ ] Commit with `Fix scoreboard colors and font loading`.

### Task 2: Persisted Development Sessions and Restore

**Files:**
- Modify: `desktop/src/renderer/api/FakeBackendClient.ts`
- Modify: `desktop/src/renderer/api/FakeBackendClient.test.ts`
- Modify: `desktop/src/renderer/state/session_reducer.ts`
- Modify: `desktop/src/renderer/state/SessionProvider.tsx`
- Modify: `desktop/src/renderer/state/SessionProvider.test.tsx`
- Modify: `desktop/src/renderer/main.tsx`

**Interfaces:**
- Produces: `FakeBackendStorage { getItem; setItem; removeItem }`, optional fake-client storage, and provider restoration through `get_active_snapshot()`.

- [ ] Write tests that launch/update a session with one fake client, construct a second client over the same storage, restore the exact revision/fields/authority, and clear it through `stop_session()`.
- [ ] Write a provider test whose backend already has an active snapshot and assert it renders `phase=active` and owns one subscription on mount.
- [ ] Run the focused API/state tests; expect restoration failures.
- [ ] Persist a versioned cloned fake state after every accepted mutation and appearance save. Hydrate defensively; remove invalid stored JSON. Add reducer restore actions guarded by generation and subscribe after successful provider restoration.
- [ ] Instantiate the development fake with `window.localStorage`, run focused tests/typecheck, and commit with `Restore persisted development sessions`.

### Task 3: Start/Stop Clock Controller

**Files:**
- Create: `desktop/src/renderer/app/manual/use_game_clock.ts`
- Create: `desktop/src/renderer/app/manual/use_game_clock.test.tsx`
- Modify: `desktop/src/renderer/app/manual/ControlField.tsx`
- Modify: `desktop/src/renderer/app/manual/ManualControlDeck.tsx`
- Modify: `desktop/src/renderer/app/manual/ManualControlDeck.test.tsx`

**Interfaces:**
- Produces: `use_game_clock({ clock, on_tick })` with `running`, `start`, and `stop`.

- [ ] With fake timers, test one-second decrement, minute rollover, zero stop, duplicate-start protection, serialized async ticks, and unmount cleanup.
- [ ] Run `npm test -- src/renderer/app/manual`; expect missing-hook/Start button failures.
- [ ] Implement one abortable interval and an in-flight guard. Add standard `Start`, `Stop`, and `Set clock` buttons for clock controls; each tick submits a complete sport state through the existing reducer.
- [ ] Add an integration assertion that the rendered ShadowRoot clock changes after a tick, run manual/state/sport tests and typecheck, then commit with `Add manual game clock controls`.

### Task 4: Traditional UI and Stable Appearance Preview

**Files:**
- Modify: `desktop/src/renderer/styles/tokens.css`
- Modify: `desktop/src/renderer/styles/global.css`
- Modify: `desktop/src/renderer/app/launch/SessionLauncher.module.css`
- Modify: `desktop/src/renderer/app/console/OperatorConsole.module.css`
- Modify: `desktop/src/renderer/app/manual/ManualControlDeck.module.css`
- Modify: `desktop/src/renderer/app/appearance/AppearanceEditor.module.css`
- Modify: `desktop/src/renderer/app/appearance/AppearanceEditor.tsx`
- Modify: `desktop/src/renderer/app/appearance/AppearanceEditor.test.tsx`

**Interfaces:**
- Produces: flat traditional control-panel styling and a Strict-Mode-safe staging renderer.

- [ ] Add a StrictMode test that opens Appearance settings, sees the preview and controls, edits staging, cancels, and reopens without an exception.
- [ ] Run appearance tests; expect the second ShadowRoot attachment failure.
- [ ] Mount the staging renderer on an imperatively-created child host and replace/dispose it atomically. Restyle with flat neutral surfaces, thin borders, compact type, standard buttons, and `#2b65ad`; remove gradients, checkerboards, glow, oversized typography, and decorative cards.
- [ ] Run the full suite/typecheck/build, validate XML/font artifacts, and exercise launch, score, clock, reload, appearance Cancel/Apply, and sport isolation in a controlled browser when available.
- [ ] Commit with `Simplify and stabilize operator console UI`.
