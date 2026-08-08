# Collapsed Device Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse successful device discovery to a compact resolved-IP row while retaining the full progress and recovery panel for unresolved discovery.

**Architecture:** Keep the backend discovery contract unchanged. `OperatorConsole` branches on the existing `discovery.phase`: `FOUND` renders a compact address summary, while other non-`IDLE` phases render the current diagnostic panel.

**Tech Stack:** React 19, TypeScript, CSS Modules, Vitest, Testing Library

## Global Constraints

- Keep the compact row in the current sidebar position above Control authority.
- Preserve the full panel for `DIRECT_CONNECT`, `PASSIVE_LOOKUP`, `BROADCAST_PROBING`, and `NOT_FOUND`.
- Do not add a modal, toast, timer, dismissal state, persistence key, or backend change.
- Display `—` when `FOUND` has no `resolved_host`.

---

### Task 1: Discovery Presentation States

**Files:**
- Modify: `desktop/src/renderer/app/console/OperatorConsole.tsx:116`
- Modify: `desktop/src/renderer/app/console/OperatorConsole.module.css:212`
- Test: `desktop/src/renderer/app/console/OperatorConsole.test.tsx:84`

**Interfaces:**
- Consumes: `snapshot.connection.discovery.phase` and `snapshot.connection.discovery.resolved_host` from the existing `DiscoveryStatus` contract.
- Produces: an accessible `Connected device` region containing a `Device IP` label and resolved address when phase is `FOUND`.

- [ ] **Step 1: Write the failing successful-discovery test**

Add this test after the current connection-summary test:

```tsx
test("collapses successful discovery to the resolved device IP", async () => {
  class FoundBackendClient extends FakeBackendClient {
    override async launch_session(
      input: LaunchSessionInput,
      signal?: AbortSignal
    ): Promise<SessionSnapshot> {
      const snapshot = await super.launch_session(input, signal);
      return {
        ...snapshot,
        connection: {
          ...snapshot.connection,
          discovery: {
            phase: "FOUND",
            active: false,
            attempts: 1,
            method: "arp_cache",
            requested_host: null,
            resolved_host: "10.93.37.138"
          }
        }
      };
    }
  }

  render(
    <SessionProvider client={new FoundBackendClient()}>
      <App />
    </SessionProvider>
  );
  await screen.findByRole("radio", { name: /Football/i });
  fill_synced_connection();
  screen.getByRole("button", { name: "Launch session" }).click();

  expect(await screen.findByRole("region", { name: "Connected device" })).toBeVisible();
  expect(screen.getByText("Device IP")).toBeVisible();
  expect(screen.getByText("10.93.37.138")).toBeVisible();
  expect(screen.queryByRole("region", { name: "Device discovery" })).not.toBeInTheDocument();
  expect(screen.queryByText("Finding scoreboard")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
cd desktop
npm test -- --run src/renderer/app/console/OperatorConsole.test.tsx
```

Expected: FAIL because the successful state still renders the full `Device discovery` panel and has no `Connected device` region.

- [ ] **Step 3: Implement the minimal presentation branch**

Before the existing discovery panel, render the compact successful state:

```tsx
{synced && discovery?.phase === "FOUND" && (
  <section className={`${styles.panel} ${styles.resolvedDevice}`} aria-label="Connected device">
    <span>Device IP</span>
    <strong>{discovery.resolved_host ?? "—"}</strong>
  </section>
)}
```

Derive the full-panel branch before the return:

```tsx
const show_full_discovery =
  synced &&
  discovery !== undefined &&
  discovery.phase !== "IDLE" &&
  discovery.phase !== "FOUND";
```

Replace the current full-panel condition with `{show_full_discovery && (` and leave its existing contents unchanged.

Add compact styling without changing other sidebar panels:

```css
.resolvedDevice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
}

.resolvedDevice span {
  color: var(--text-muted);
  font-size: 11px;
}

.resolvedDevice strong {
  overflow-wrap: anywhere;
  font-family: ui-monospace, monospace;
  font-size: 13px;
}
```

- [ ] **Step 4: Run focused and complete verification**

Run:

```bash
cd desktop
npm test -- --run src/renderer/app/console/OperatorConsole.test.tsx
npm test
npm run typecheck
npm run build
```

Expected: the focused console tests pass, all frontend tests pass, typechecking succeeds, and the production renderer/main build completes.

- [ ] **Step 5: Commit the implementation**

```bash
git add desktop/src/renderer/app/console/OperatorConsole.tsx \
  desktop/src/renderer/app/console/OperatorConsole.module.css \
  desktop/src/renderer/app/console/OperatorConsole.test.tsx
git commit -m "Collapse successful device discovery"
```
