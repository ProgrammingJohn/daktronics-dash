# Electron Packaging and Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the approved operator console, OBS viewer, and Python service into a single macOS Electron application with safe startup, fixed localhost routing, persistent application data, and clean shutdown.

**Architecture:** Electron owns the desktop lifecycle and starts one PyInstaller-built Python sidecar on `127.0.0.1:5000`. Flask serves the Vite-built operator and viewer entries, while writable preferences and logs live in Electron's application-data directory rather than packaged resources.

**Tech Stack:** Electron, Electron Forge, TypeScript, Node child processes, React/Vite build output, Flask, Waitress, PyInstaller, Python unittest, Vitest.

## Global Constraints

- Complete the rendering-foundation and operator-console plans first.
- Start this plan only after the user's transmission-agent handoff has supplied and verified the production `BackendClient` adapter.
- Do not change ESP32 firmware or files under `transmission/`.
- Bind HTTP only to `127.0.0.1`; OBS runs on the same computer.
- Keep `http://127.0.0.1:5000/viewer` stable.
- Never terminate an unknown process occupying port `5000`.
- Electron may force-terminate only the exact child process it created and only after graceful shutdown times out.
- Treat packaged resources as read-only; persist preferences, profiles, recent choices, and logs under the supplied application-data directory.
- Use `nodeIntegration: false`, `contextIsolation: true`, and `sandbox: true` for BrowserWindow.
- The packaged application must start and render without internet access.

---

## File Map

- Create `services/app_paths.py`: packaged-resource and writable-data path resolution.
- Modify `services/utils.py`: versioned preferences in the writable data directory.
- Refactor `main.py`: `create_app()` factory and desktop/static routes.
- Create `routes/desktop.py`: operator/viewer assets, health, and viewer heartbeat.
- Create `desktop_backend.py`: production Waitress entry with host/port/data-dir arguments.
- Create `dakdash_backend.spec`: PyInstaller asset manifest.
- Create `requirements-build.txt`: build-only Python tooling.
- Create `desktop/src/main/backend_process.ts`: child startup, readiness, logs, and shutdown.
- Create `desktop/src/main/main.ts`: single-instance Electron lifecycle and BrowserWindow.
- Create `desktop/tsconfig.main.json`: Node/Electron compilation.
- Create `desktop/forge.config.ts`: macOS packaging and sidecar resources.
- Modify `desktop/package.json`: Electron build/package scripts.
- Modify `README.md`: development, package, OBS, and recovery instructions.

### Task 1: Writable Application Data and Packaged Resource Paths

**Files:**
- Create: `services/app_paths.py`
- Create: `tests/test_app_paths.py`
- Modify: `services/utils.py`
- Create: `tests/test_preferences.py`

**Interfaces:**
- Consumes: `DAKDASH_DATA_DIR`, `sys._MEIPASS` when packaged, and repository defaults.
- Produces: `resource_path(*parts)`, `data_path(*parts)`, `initialize_data_dir()`, `get_scoreboard_preferences()`, and `write_scorebaord_preferences()` using writable storage.

- [ ] **Step 1: Write failing path and preference tests**

Use `tempfile.TemporaryDirectory` and `unittest.mock.patch.dict` to assert that resources resolve under the repository in development, data resolves under `DAKDASH_DATA_DIR`, first launch copies default preferences, writes are atomic, and a second initialization preserves user changes.

```python
with tempfile.TemporaryDirectory() as temp_dir:
    with patch.dict(os.environ, {"DAKDASH_DATA_DIR": temp_dir}):
        initialize_data_dir()
        preferences = get_scoreboard_preferences()
        preferences["football"]["home_team_name"] = "HHS"
        write_scorebaord_preferences(preferences)
        self.assertEqual(get_scoreboard_preferences()["football"]["home_team_name"], "HHS")
```

- [ ] **Step 2: Run tests and verify the missing-module/current-path failures**

Run: `python3 -m unittest tests.test_app_paths tests.test_preferences -v`

Expected: FAIL because `services.app_paths` does not exist and preferences still write beside bundled SVGs.

- [ ] **Step 3: Implement explicit path resolution and seeding**

`resource_path` uses `Path(getattr(sys, "_MEIPASS", repository_root))`. `data_path` uses `DAKDASH_DATA_DIR` when supplied and otherwise uses `<repository>/.dakdash-data` only in an unpackaged development run; a packaged process without `DAKDASH_DATA_DIR` fails at startup. Resolve the chosen root and reject path traversal outside it. `initialize_data_dir` creates the directory and copies `scoreboard_preferences.json` only when no writable copy exists.

- [ ] **Step 4: Make preference writes atomic**

Write JSON to a named temporary file inside the data directory, flush and `os.fsync`, then replace the destination with `os.replace`. Preserve the existing public misspelled function name for compatibility. Never write to `scoreboard_svgs/scoreboard_preferences.json` at runtime.

- [ ] **Step 5: Verify and commit application data behavior**

Run: `python3 -m unittest tests.test_app_paths tests.test_preferences -v`

Expected: all path and preference tests pass.

```bash
git add services/app_paths.py services/utils.py tests/test_app_paths.py tests/test_preferences.py
git commit -m "Store desktop preferences in application data"
```

### Task 2: Flask Desktop Routes and Production Server Entry

**Files:**
- Create: `routes/desktop.py`
- Create: `tests/test_desktop_routes.py`
- Modify: `routes/__init__.py`
- Modify: `main.py`
- Create: `desktop_backend.py`
- Create: `tests/test_desktop_backend.py`
- Modify: `requirements.txt`

**Interfaces:**
- Consumes: Vite output at `desktop/dist`, `create_app(data_dir)`, and existing API blueprints.
- Produces: `/app`, `/viewer`, `/assets/<path>`, `/api/app/health`, `/api/viewer/heartbeat`, and `desktop_backend.main(argv)`.

- [ ] **Step 1: Write failing route and command-line tests**

Create a temporary dist directory containing different operator/viewer markers. Assert `/app` serves only the operator HTML, `/viewer` serves only viewer HTML, assets use `send_from_directory`, health returns `{ "application": "dakdash", "status": "ready" }`, and heartbeat records a session ID and expires after three seconds.

Test argument parsing with:

```python
args = parse_args(["--host", "127.0.0.1", "--port", "5000", "--data-dir", "/tmp/dakdash-test"])
self.assertEqual(args.port, 5000)
self.assertEqual(args.host, "127.0.0.1")
```

- [ ] **Step 2: Run tests and verify missing routes and entry module**

Run: `python3 -m unittest tests.test_desktop_routes tests.test_desktop_backend -v`

Expected: FAIL importing the new blueprint and desktop entry.

- [ ] **Step 3: Refactor Flask construction without changing API behavior**

Implement `create_app(data_dir=None, frontend_dist=None)`. It sets `DAKDASH_DATA_DIR`, initializes writable data, registers the existing API blueprint and new desktop blueprint, and returns the app. Keep module-level `app = create_app()` for current tooling compatibility. Replace the old `/viewer` Jinja route with the built viewer route only after its route test passes.

- [ ] **Step 4: Add Waitress production entry and lifecycle logging**

Add `waitress` to `requirements.txt`. `desktop_backend.main` rejects non-loopback hosts, configures line-buffered logging, builds the app, and calls `waitress.serve(app, host=args.host, port=args.port, threads=4)`. It handles `SIGTERM` by exiting cleanly and logs one readiness line containing the fixed URL.

- [ ] **Step 5: Verify routes, current APIs, and commit**

Run:

```bash
python3 -m unittest tests.test_desktop_routes tests.test_desktop_backend -v
python -m compileall main.py desktop_backend.py routes services
python parse-football-test.py
```

Expected: route tests pass, compilation succeeds, and the parser smoke check completes successfully.

```bash
git add main.py desktop_backend.py routes services requirements.txt tests
git commit -m "Serve desktop console from production Flask entry"
```

### Task 3: Electron Backend Supervisor and Secure Window

**Files:**
- Modify: `desktop/package.json`
- Create: `desktop/tsconfig.main.json`
- Create: `desktop/src/main/backend_process.ts`
- Create: `desktop/src/main/backend_process.test.ts`
- Create: `desktop/src/main/main.ts`
- Create: `desktop/src/main/main.test.ts`

**Interfaces:**
- Consumes: `desktop_backend.py` in development, packaged `dakdash-backend`, Electron `app.getPath("userData")`, and `/api/app/health`.
- Produces: `BackendProcess.start()`, `wait_until_ready()`, `stop()`, `create_main_window()`, and one single-instance application lifecycle.

- [ ] **Step 1: Install Electron tooling and write supervisor tests**

Run:

```bash
cd desktop
npm install --save-dev electron @electron-forge/cli @electron-forge/maker-dmg @electron-forge/maker-zip @types/node
```

Write tests with an injected `spawn_process` and `fetch_health`. Assert exact argv, `shell: false`, log redirection, readiness retry, fixed-port conflict reporting, graceful `SIGTERM`, bounded `SIGKILL` only for the owned child, and no kill when no child was started.

- [ ] **Step 2: Run supervisor tests and verify missing exports**

Run: `cd desktop && npm test -- src/main/backend_process.test.ts src/main/main.test.ts`

Expected: FAIL importing the main-process modules.

- [ ] **Step 3: Implement development/packaged command resolution**

Development command:

```text
python3 <repository>/desktop_backend.py --host 127.0.0.1 --port 5000 --data-dir <userData>
```

Packaged command:

```text
<process.resourcesPath>/backend/dakdash-backend --host 127.0.0.1 --port 5000 --data-dir <userData>
```

Before spawning, request `/api/app/health`. Any response or bind result showing an occupied port produces a visible startup error; do not attach to or terminate the occupant. Retry health every 100 ms for at most 10 seconds after spawn.

- [ ] **Step 4: Implement single-instance and BrowserWindow lifecycle**

Acquire `app.requestSingleInstanceLock()` before starting the backend. Create a BrowserWindow only after health is ready with exact security settings `nodeIntegration: false`, `contextIsolation: true`, and `sandbox: true`; load `http://127.0.0.1:5000/app`. On `before-quit`, await bounded backend stop. On a second-instance event, focus the existing window.

- [ ] **Step 5: Verify TypeScript and commit the supervisor**

Run: `cd desktop && npm test -- src/main && npx tsc --project tsconfig.main.json --noEmit`

Expected: supervisor tests pass and Electron main-process types compile.

```bash
git add desktop/package.json desktop/package-lock.json desktop/tsconfig.main.json desktop/src/main
git commit -m "Add secure Electron backend lifecycle"
```

### Task 4: PyInstaller and Electron Forge Package

**Files:**
- Create: `requirements-build.txt`
- Create: `dakdash_backend.spec`
- Create: `desktop/forge.config.ts`
- Create: `desktop/scripts/build_backend.mjs`
- Modify: `desktop/package.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: Vite `desktop/dist`, Python sources/assets, and compiled Electron main files.
- Produces: `dist-backend/dakdash-backend` and a macOS `.app`/DMG containing it under `Contents/Resources/backend/`.

- [ ] **Step 1: Add a failing package-layout verification script**

Create `desktop/scripts/verify_package.mjs` that receives the `.app` path, checks the Electron executable, backend executable, bundled scoreboard SVGs, fonts, operator HTML, and viewer HTML, and exits nonzero with the full missing path for any absent artifact.

Run it against a nonexistent package and verify it fails with `Missing packaged artifact`.

- [ ] **Step 2: Define the Python bundle explicitly**

Add `pyinstaller` to `requirements-build.txt`. The spec uses `desktop_backend.py` as entry, includes `templates/`, `scoreboard_svgs/`, `static/fonts/`, and `desktop/dist/`, and excludes `.env`, virtual environments, `.DS_Store`, transmission firmware, tests, and venue-specific writable preferences.

- [ ] **Step 3: Define ordered build scripts**

`npm run package` must run these steps in order: frontend tests, frontend typecheck, Vite build, Python compile check, PyInstaller build, Electron main compile, Forge package, then package verification. `npm run make` runs the same gates and Forge makers. No build step downloads runtime assets.

- [ ] **Step 4: Configure Forge resources and macOS makers**

Set the packaged main entry to compiled `dist-main/main.js`, enable ASAR for Electron code, add `dist-backend/dakdash-backend` as an extra resource under `backend/`, and configure ZIP and DMG makers. Add `.dakdash-data/`, `desktop/dist/`, `desktop/dist-main/`, `dist-backend/`, `build/`, and `out/` to `.gitignore` without altering existing ignore entries.

- [ ] **Step 5: Build, verify, and commit packaging**

Run:

```bash
python3 -m pip install -r requirements-build.txt
cd desktop
npm run package
```

Expected: all gates pass and package verification finds every required artifact.

```bash
git add requirements-build.txt dakdash_backend.spec desktop .gitignore
git commit -m "Package DakDash as an Electron application"
```

### Task 5: Packaged Lifecycle and Offline Acceptance

**Files:**
- Create: `tests/test_packaged_desktop.py`
- Modify: `README.md`

**Interfaces:**
- Consumes: packaged `.app`, localhost routes, child-process logs, and viewer heartbeat.
- Produces: repeatable package smoke test and operator runbook.

- [ ] **Step 1: Write a packaged smoke-test harness**

The Python test accepts `DAKDASH_APP_PATH`, launches the `.app` executable as a child, waits up to 15 seconds for health, verifies `/app` and `/viewer`, posts a viewer heartbeat, confirms the status reports recent evidence, terminates the app, and asserts port `5000` stops accepting connections within five seconds. It records stdout/stderr on failure.

- [ ] **Step 2: Run the smoke test against no package and verify the explicit skip/failure contract**

Run: `python3 -m unittest tests.test_packaged_desktop -v`

Expected: SKIP with `DAKDASH_APP_PATH is not set`, proving normal Python validation does not depend on a built application.

- [ ] **Step 3: Document exact development and packaging workflows**

README instructions must include Python setup, `cd desktop && npm install`, separate backend/Vite development commands, `npm test`, `npm run typecheck`, `npm run package`, the stable OBS URL, application-data/log locations, fixed-port conflict recovery, and the fact that the viewer is localhost-only.

- [ ] **Step 4: Run online and offline packaged verification**

Run the package smoke test with `DAKDASH_APP_PATH` set. Then disable network connectivity, relaunch the app, load the viewer in OBS or a browser, launch one manual fixture/session, and confirm no CDN or external font request occurs.

- [ ] **Step 5: Run the complete project gate and commit documentation**

Run:

```bash
python3 -m unittest discover -s tests -v
python -m compileall main.py desktop_backend.py routes services
python parse-football-test.py
cd desktop
npm test
npm run typecheck
npm run build
npm run package
```

Expected: all automated checks pass, the smoke test passes when the app path is set, and the offline manual check shows a stable operator and viewer.

```bash
git add tests/test_packaged_desktop.py README.md
git commit -m "Document and verify packaged desktop workflow"
```

## Phase Acceptance

- One macOS application starts the Python service and operator console without a terminal.
- Only one app/backend instance runs, and an unknown port occupant is never killed.
- Operator assets, viewer assets, fonts, SVGs, and Python code are contained in the package.
- Runtime preferences and logs are written only under application data.
- OBS continues to use `http://127.0.0.1:5000/viewer`.
- Closing Electron stops the exact sidecar it created.
- The application launches and renders offline.
- Existing Python tests, parser smoke checks, frontend tests, type checking, builds, and package smoke tests pass.
