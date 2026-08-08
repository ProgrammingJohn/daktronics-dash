# Frontend Rendering Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the React/TypeScript frontend foundation, isolated SVG renderer, typed sport modules, and a standalone viewer that can render recorded snapshots without touching transmission code.

**Architecture:** A Vite-built React renderer validates typed sport snapshots, derives sport-specific view models, and passes declared bindings to one ShadowRoot-scoped `ScoreboardRenderer` per preview. The first phase uses recorded fixtures and a fake snapshot source so rendering can be completed and reviewed independently of Flask and the transmission agent.

**Tech Stack:** React, React DOM, strict TypeScript, Vite, Zod, Vitest, React Testing Library, jsdom, native Shadow DOM and DOMParser APIs.

## Global Constraints

- Do not modify files under `transmission/`.
- Do not modify Python transport, connection, discovery, or parsing code.
- Add no jQuery, Axios, router, global state library, component library, CSS-in-JS package, or SVG manipulation library.
- Keep `scoreboard_svgs/` as the canonical SVG source.
- Render only declared semantic bindings; never turn arbitrary API keys into selectors.
- Every renderer instance must isolate selectors, internal SVG IDs, fragment references, and embedded style rules.
- Use two spaces in TypeScript, TSX, CSS, HTML, and JSON.
- Run `tsc --noEmit` separately because Vite does not type-check builds.

---

## File Map

- Create `desktop/package.json`: frontend dependencies and validation scripts.
- Create `desktop/tsconfig.json`: strict browser TypeScript configuration.
- Create `desktop/vite.config.ts`: multi-page operator/viewer development build and Vitest setup.
- Create `desktop/index.html` and `desktop/viewer.html`: Vite entry documents.
- Create `desktop/src/renderer/test/setup.ts`: DOM test setup.
- Create `desktop/src/renderer/app/App.tsx`: temporary foundation screen used until the console plan.
- Create `desktop/src/renderer/domain/session.ts`: normalized session and connection schemas.
- Create `desktop/src/renderer/sports/types.ts`: sport-module contracts.
- Create `desktop/src/renderer/sports/registry.ts`: explicit sport registration.
- Create one module and fixture under each `desktop/src/renderer/sports/<sport>/` directory.
- Create `desktop/src/renderer/scoreboard/ScoreboardRenderer.ts`: ShadowRoot mount, ID namespace, binding, and disposal.
- Create `desktop/src/renderer/viewer/Viewer.tsx`: renderer-only OBS surface.
- Create `desktop/src/renderer/viewer/snapshot_source.ts`: cancellable snapshot-source interface and fake source.
- Modify each `scoreboard_svgs/*.svg`: add semantic `data-score-field` and `data-appearance-field` attributes without changing visible geometry.

### Task 1: Strict Vite and React Test Harness

**Files:**
- Create: `desktop/package.json`
- Create: `desktop/tsconfig.json`
- Create: `desktop/vite.config.ts`
- Create: `desktop/index.html`
- Create: `desktop/viewer.html`
- Create: `desktop/src/renderer/main.tsx`
- Create: `desktop/src/renderer/app/App.tsx`
- Create: `desktop/src/renderer/app/App.test.tsx`
- Create: `desktop/src/renderer/test/setup.ts`
- Create: `desktop/src/renderer/styles/global.css`

**Interfaces:**
- Consumes: no project frontend interfaces.
- Produces: `npm run dev`, `npm run build`, `npm run typecheck`, and `npm test`; React operator and viewer entry points.

- [ ] **Step 1: Add package metadata and install the exact dependency set**

Create `desktop/package.json` with these scripts and no other runtime dependencies:

```json
{
  "name": "dakdash-desktop",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Run:

```bash
cd desktop
npm install react react-dom zod
npm install --save-dev typescript vite @vitejs/plugin-react vitest jsdom @testing-library/react @testing-library/jest-dom @types/react @types/react-dom
```

Expected: `package-lock.json` is created and only the listed packages are direct dependencies.

- [ ] **Step 2: Write the failing application smoke test**

```tsx
// desktop/src/renderer/app/App.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the frontend foundation", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "DakDash" })).toBeVisible();
    expect(screen.getByText("Frontend foundation ready")).toBeVisible();
  });
});
```

- [ ] **Step 3: Run the test and verify the missing-module failure**

Run: `cd desktop && npm test -- src/renderer/app/App.test.tsx`

Expected: FAIL because `App.tsx` and test configuration do not exist.

- [ ] **Step 4: Add strict configuration and the minimal app**

Configure `tsconfig.json` with `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `jsx: react-jsx`, DOM libraries, and `types: ["vitest/globals", "@testing-library/jest-dom"]`. Configure Vite with the React plugin, both HTML inputs, jsdom, and `src/renderer/test/setup.ts`.

```tsx
// desktop/src/renderer/app/App.tsx
export function App() {
  return (
    <main>
      <h1>DakDash</h1>
      <p>Frontend foundation ready</p>
    </main>
  );
}
```

```tsx
// desktop/src/renderer/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./styles/global.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");
createRoot(root).render(<StrictMode><App /></StrictMode>);
```

Both HTML files must contain one `<div id="root"></div>` and a module script for their corresponding entry. `setup.ts` imports `@testing-library/jest-dom/vitest`.

- [ ] **Step 5: Verify and commit the harness**

Run:

```bash
cd desktop
npm test -- src/renderer/app/App.test.tsx
npm run typecheck
npm run build
```

Expected: one test passes, type checking exits 0, and Vite emits both HTML entries.

```bash
git add desktop
git commit -m "Add typed frontend test harness"
```

### Task 2: Normalized Schemas and Sport Contracts

**Files:**
- Create: `desktop/src/renderer/domain/session.ts`
- Create: `desktop/src/renderer/domain/session.test.ts`
- Create: `desktop/src/renderer/sports/types.ts`
- Create: `desktop/src/renderer/sports/registry.ts`
- Create: `desktop/src/renderer/sports/registry.test.ts`

**Interfaces:**
- Consumes: Zod.
- Produces: `SportId`, `TransmissionSource`, `ConnectionStatus`, `SessionSnapshot`, `session_snapshot_schema`, `SvgBinding<TView>`, `SportModule<TScore,TView>`, `register_sport()`, `get_sport()`, and `list_sports()`.

- [ ] **Step 1: Write schema and registry failures first**

Test that a valid snapshot parses, an unknown connection status fails, a negative revision fails, duplicate sport registration throws, and unknown lookup throws.

```ts
const valid = session_snapshot_schema.parse({
  session: { session_id: "session-1", sport: "football", source: "synced", control_authority: "daktronics" },
  connection: { status: "live", backend_status: "LIVE", last_update_at: "2026-08-08T12:00:00Z", source_age_ms: 120, message: null },
  scoreboard: { revision: 4, fields: { home_score: 7 } }
});
expect(valid.scoreboard.revision).toBe(4);
```

- [ ] **Step 2: Run focused tests and verify missing exports**

Run: `cd desktop && npm test -- src/renderer/domain/session.test.ts src/renderer/sports/registry.test.ts`

Expected: FAIL importing the new modules.

- [ ] **Step 3: Implement exact domain types and binding operations**

```ts
export const sport_id_schema = z.enum(["baseball", "basketball", "football"]);
export const transmission_source_schema = z.enum(["manual", "synced"]);
export const connection_status_schema = z.enum(["live", "stale", "disconnected"]);

export const session_snapshot_schema = z.object({
  session: z.object({
    session_id: z.string().min(1),
    sport: sport_id_schema,
    source: transmission_source_schema,
    control_authority: z.enum(["daktronics", "manual"])
  }),
  connection: z.object({
    status: connection_status_schema,
    backend_status: z.string(),
    last_update_at: z.string().nullable(),
    source_age_ms: z.number().nonnegative().nullable(),
    message: z.string().nullable()
  }),
  scoreboard: z.object({
    revision: z.number().int().nonnegative(),
    fields: z.record(z.string(), z.unknown())
  })
});
```

Define `SvgBinding<TView>` as a discriminated union for `text`, `attribute`, `visibility`, and `style` operations. Define `SportModule` with the exact fields approved in the design: `id`, `display_name`, `supported_sources`, `score_schema`, `initial_score`, `derive_view`, `bindings`, `controls`, and `appearance`.

- [ ] **Step 4: Implement an explicit registry with duplicate protection**

Define `AnySportModule = SportModule<any, any>` at the registry boundary. The registry stores modules in a `Map<SportId, AnySportModule>`. `register_sport` throws `Sport already registered: <id>`, `get_sport` throws `Unknown sport: <id>`, and `list_sports` returns a frozen array in baseball, basketball, football order.

- [ ] **Step 5: Verify and commit domain contracts**

Run: `cd desktop && npm test -- src/renderer/domain src/renderer/sports/registry.test.ts && npm run typecheck`

Expected: all focused tests pass and type checking exits 0.

```bash
git add desktop/src/renderer/domain desktop/src/renderer/sports
git commit -m "Define frontend session and sport contracts"
```

### Task 3: ShadowRoot-Scoped SVG Renderer

**Files:**
- Create: `desktop/src/renderer/scoreboard/ScoreboardRenderer.ts`
- Create: `desktop/src/renderer/scoreboard/ScoreboardRenderer.test.ts`
- Create: `desktop/src/renderer/scoreboard/svg_references.ts`
- Create: `desktop/src/renderer/scoreboard/svg_references.test.ts`

**Interfaces:**
- Consumes: `SvgBinding<TView>` from Task 2.
- Produces: `rewrite_svg_ids(svg, prefix)`, `ScoreboardRenderer.mount(svg_text, bindings)`, `render(view)`, and `dispose()`.

- [ ] **Step 1: Write renderer isolation tests**

Use an SVG fixture containing a gradient, clip path, `href`, embedded style, and semantic fields. Assert that two renderers produce different prefixed IDs, every `url(#...)` and `href` points at its local definition, text updates stay inside the requested root, both hosts have ShadowRoots, missing semantic fields throw, and `dispose()` empties the host.

```ts
const first = new ScoreboardRenderer(first_host);
const second = new ScoreboardRenderer(second_host);
first.mount(svg_fixture, bindings);
second.mount(svg_fixture, bindings);
first.render({ home_score: 7 });
expect(first.shadowRoot.querySelector('[data-score-field="home_score"]')?.textContent).toBe("7");
expect(second.shadowRoot.querySelector('[data-score-field="home_score"]')?.textContent).toBe("0");
```

- [ ] **Step 2: Run tests and verify they fail before implementation**

Run: `cd desktop && npm test -- src/renderer/scoreboard`

Expected: FAIL importing `ScoreboardRenderer` and `svg_references`.

- [ ] **Step 3: Implement complete ID and reference rewriting**

`rewrite_svg_ids` must build an old-to-new ID map, rewrite every `id`, and update these reference locations:

```ts
export const URL_REFERENCE_ATTRIBUTES = [
  "clip-path", "fill", "filter", "marker-end", "marker-mid",
  "marker-start", "mask", "stroke"
] as const;

export const HASH_REFERENCE_ATTRIBUTES = [
  "href", "xlink:href", "aria-labelledby", "aria-describedby"
] as const;
```

Replace all `url(#oldId)` occurrences in attributes, inline `style`, and embedded `<style>` text. Replace `#oldId` hash references token-by-token. Prefix values with `dakdash-<monotonic-instance-number>-` so tests remain deterministic.

- [ ] **Step 4: Implement mount, binding validation, rendering, and disposal**

The constructor attaches one open ShadowRoot. `mount` parses with `DOMParser`, rejects `<parsererror>`, requires one `<svg>`, namespaces it, appends a renderer-local reset style plus the SVG, and resolves every binding selector within that SVG. Zero or multiple matches throw `Invalid SVG binding <selector>: expected 1, found <count>`.

`render` uses `textContent`, `setAttribute`, `hidden`, or `svg.style.setProperty` according to the binding kind. `dispose` clears the ShadowRoot, bindings, and mounted SVG reference. Rendering after disposal throws `ScoreboardRenderer is not mounted`.

- [ ] **Step 5: Verify renderer behavior and commit**

Run: `cd desktop && npm test -- src/renderer/scoreboard && npm run typecheck`

Expected: all renderer and reference tests pass.

```bash
git add desktop/src/renderer/scoreboard
git commit -m "Add isolated SVG scoreboard renderer"
```

### Task 4: Baseball, Basketball, and Football Modules

**Files:**
- Modify: `scoreboard_svgs/baseball.svg`
- Modify: `scoreboard_svgs/basketball.svg`
- Modify: `scoreboard_svgs/football.svg`
- Create: `desktop/src/renderer/sports/baseball/module.ts`
- Create: `desktop/src/renderer/sports/baseball/module.test.ts`
- Create: `desktop/src/renderer/sports/baseball/fixtures.ts`
- Create: `desktop/src/renderer/sports/basketball/module.ts`
- Create: `desktop/src/renderer/sports/basketball/module.test.ts`
- Create: `desktop/src/renderer/sports/basketball/fixtures.ts`
- Create: `desktop/src/renderer/sports/football/module.ts`
- Create: `desktop/src/renderer/sports/football/module.test.ts`
- Create: `desktop/src/renderer/sports/registry.ts`

**Interfaces:**
- Consumes: `SportModule`, Zod, and the canonical score field names already produced by Python.
- Produces: `baseball_module`, `basketball_module`, and `football_module` registered in the sport registry.

- [ ] **Step 1: Write fixture-driven derivation and binding tests**

For each sport, parse a complete fixture, call `derive_view`, and assert exact formatted output. Required assertions are:

```ts
expect(baseball_module.derive_view(baseball_live).inning_text).toBe("top 3");
expect(baseball_module.derive_view(baseball_live).count_text).toBe("2 - 1");
expect(basketball_module.derive_view(basketball_live).clock_text).toBe("7:04");
expect(basketball_module.derive_view(basketball_live).period_text).toBe("3rd");
expect(football_module.derive_view(football_live).down_text).toBe("2nd & 6");
expect(football_module.derive_view(football_live).possession).toBe("home");
```

Also mount each SVG through `ScoreboardRenderer` and assert every declared binding resolves.

- [ ] **Step 2: Run sport tests and verify missing-module failures**

Run: `cd desktop && npm test -- src/renderer/sports/baseball src/renderer/sports/basketball src/renderer/sports/football`

Expected: FAIL because the module files and semantic SVG attributes do not exist.

- [ ] **Step 3: Add semantic SVG attributes without changing artwork**

Add `data-score-field` to score, name, clock, period, inning/count/out, bases, fouls, bonuses, timeouts, down-and-distance, and possession elements. Add `data-appearance-field` to elements or the SVG root that consume team color tokens. Preserve every viewBox, path, transform, font, gradient, and visible default. Do not remove IDs; Task 3 namespaces them at mount.

- [ ] **Step 4: Implement typed modules and register them**

Each module defines a strict Zod score schema, initial score, pure `derive_view`, explicit bindings, source support, control definitions, and appearance token declarations. Use these source capabilities:

```ts
baseball_module.supported_sources = ["manual", "synced"];
basketball_module.supported_sources = ["manual", "synced"];
football_module.supported_sources = ["manual", "synced"];
```

Keep ordinal-period, clock, timeout, and visibility formatting in pure exported helper functions. Register all three modules once in `registry.ts`; do not use side-effect imports in tests.

- [ ] **Step 5: Verify SVG integrity, sport tests, and commit**

Run:

```bash
cd desktop
npm test -- src/renderer/sports src/renderer/scoreboard
npm run typecheck
npm run build
```

Expected: all tests pass, type checking exits 0, and SVG raw imports build.

```bash
git add scoreboard_svgs desktop/src/renderer/sports
git commit -m "Add isolated sport rendering modules"
```

### Task 5: Standalone Viewer with Last-Good Retention

**Files:**
- Create: `desktop/src/renderer/viewer/snapshot_source.ts`
- Create: `desktop/src/renderer/viewer/fake_snapshot_source.ts`
- Create: `desktop/src/renderer/viewer/Viewer.tsx`
- Create: `desktop/src/renderer/viewer/Viewer.test.tsx`
- Create: `desktop/src/renderer/viewer/main.tsx`
- Modify: `desktop/viewer.html`

**Interfaces:**
- Consumes: `SessionSnapshot`, `get_sport`, and `ScoreboardRenderer`.
- Produces: `SnapshotSource.subscribe(signal, on_snapshot, on_error)`, `Viewer`, and a buildable viewer entry with no operator imports.

- [ ] **Step 1: Write viewer lifecycle and retention tests**

Create a fake source that emits snapshots on demand. Assert that the viewer mounts the selected sport, accepts only newer revisions, retains the last rendered score after an error, swaps sport renderers on a new session, and aborts the subscription on unmount.

```tsx
const source = new FakeSnapshotSource();
const { unmount } = render(<Viewer source={source} />);
act(() => source.emit(football_snapshot({ revision: 1, home_score: 7 })));
expect(screen.getByTestId("viewer-status")).toHaveTextContent("live");
act(() => source.fail(new Error("offline")));
expect(screen.getByTestId("viewer-status")).toHaveTextContent("disconnected");
expect(read_shadow_text("home_score")).toBe("7");
unmount();
expect(source.aborted).toBe(true);
```

- [ ] **Step 2: Run the viewer test and verify missing exports**

Run: `cd desktop && npm test -- src/renderer/viewer/Viewer.test.tsx`

Expected: FAIL importing `Viewer` and `FakeSnapshotSource`.

- [ ] **Step 3: Implement the cancellable source and viewer component**

`SnapshotSource.subscribe` receives one `AbortSignal`; its disposer must abort pending work. `Viewer` keeps the last accepted snapshot in a ref, ignores revisions less than or equal to the accepted revision for the current session, creates a new renderer only when sport/session identity changes, and renders connection status outside the SVG for tests with `aria-live="polite"`.

The production viewer CSS makes status text visually hidden so OBS receives only the scoreboard. No viewer file may import from `app/`, manual controls, Electron preload, or wizard code.

- [ ] **Step 4: Add the independent viewer entry**

`viewer/main.tsx` mounts `Viewer` into `#root`. For this phase, instantiate `FakeSnapshotSource` with a recorded football snapshot so `npm run dev` provides a visible review target. Plan 2 replaces only the source construction with the backend client.

- [ ] **Step 5: Run the full phase gate and commit**

Run:

```bash
cd desktop
npm test
npm run typecheck
npm run build
```

Expected: all tests pass, type checking exits 0, both entries build, and `dist/viewer.html` contains no operator entry chunk.

Manually open the Vite viewer and confirm baseball, basketball, and football fixtures render without console errors or cross-instance changes.

```bash
git add desktop
git commit -m "Add standalone retained-state viewer"
```

## Phase Acceptance

- All three sport modules render recorded snapshots through one shared renderer.
- Live and staging instances can coexist without ID, selector, or style conflicts.
- The viewer has no dependency on operator, wizard, manual-control, jQuery, or Electron code.
- A malformed snapshot or source error retains the last accepted SVG state.
- `npm test`, `npm run typecheck`, and `npm run build` pass from `desktop/`.
- No Python or transmission behavior changes in this phase.
