# Electron Universal macOS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce an unsigned, self-contained DakDash macOS application that runs natively on Apple Silicon and Intel, launches the existing Flask backend, and exposes the operator console and OBS viewer on a stable loopback URL.

**Architecture:** Electron owns the application lifecycle and starts a PyInstaller backend executable matching `process.arch`. A dedicated packaged Flask entry point serves the Vite build and existing API from `127.0.0.1:5000`; Electron waits for readiness before opening the operator window and stops only its child process on app quit. Release automation builds arm64 and x64 backend executables, places both in each Electron bundle, and uses `@electron/universal` to merge the Electron applications.

**Tech Stack:** Electron, Electron Forge/Packager, `@electron/universal`, Vite, TypeScript, Vitest, Flask, PyInstaller, shell release scripts.

## Global Constraints

- Do not require Apple Developer credentials, signing, or notarization.
- Do not require Python, Node.js, or Rosetta on the operator's Mac.
- Bind browser and API traffic to `127.0.0.1` only.
- Keep the OBS viewer URL stable at `http://127.0.0.1:58321/viewer.html`.
- Do not change firmware, protocol, parser, supervisor, or connection-state logic.
- Preserve the one-second viewer polling behavior.
- Package no credentials or venue-specific network values.

---

### Task 1: Packaged Flask Application

**Files:**
- Create: `desktop_backend.py`
- Create: `tests/test_desktop_backend.py`

**Interfaces:**
- Consumes: `routes.register_route_blueprints(app)` and `desktop/dist`.
- Produces: `create_desktop_app(base_path: Path | None = None) -> Flask` and a loopback-only executable entry point.

- [ ] **Step 1: Write failing route tests**

  Test that `/` returns the built operator page, `/viewer.html` returns the built viewer page, static assets are available, and the existing `/api/scoreboard-service/status` route remains registered.

- [ ] **Step 2: Verify the tests fail**

  Run `python3 -m unittest tests.test_desktop_backend -v` and confirm `desktop_backend` is missing.

- [ ] **Step 3: Implement the desktop Flask factory**

  Resolve development files from the repository and packaged files from `sys._MEIPASS`, create Flask with `static_folder=desktop/dist/assets`, register the API blueprints, and run only on `127.0.0.1:5000` when executed as a program.

- [ ] **Step 4: Verify the tests pass**

  Run `python3 -m unittest tests.test_desktop_backend -v`.

### Task 2: Electron Backend Lifecycle

**Files:**
- Create: `desktop/src/main/backendProcess.ts`
- Create: `desktop/src/main/backendProcess.test.ts`
- Create: `desktop/src/main/main.ts`
- Modify: `desktop/tsconfig.json`

**Interfaces:**
- Consumes: Electron `app`, `BrowserWindow`, Node `child_process`, and bundled executables under `process.resourcesPath/backend`.
- Produces: `backendExecutable(resourcesPath, arch)`, `waitForBackend(url, options)`, and `startBackend(options)`.

- [ ] **Step 1: Write failing architecture and readiness tests**

  Assert literal paths for arm64/x64, reject unsupported architectures, confirm readiness retries until HTTP success, and confirm timeout errors include actionable text.

- [ ] **Step 2: Verify the tests fail**

  Run `npm test -- src/main/backendProcess.test.ts` from `desktop/`.

- [ ] **Step 3: Implement minimal lifecycle helpers and Electron main**

  Spawn only the selected executable, wait for `http://127.0.0.1:58321/api/scoreboard-service/status`, open `http://127.0.0.1:58321/`, keep Node integration disabled with context isolation enabled, enforce a single instance, and terminate the owned child during application quit.

- [ ] **Step 4: Verify tests and types**

  Run `npm test -- src/main/backendProcess.test.ts` and `npm run typecheck`.

### Task 3: Development and Package Configuration

**Files:**
- Create: `desktop/forge.config.ts`
- Modify: `desktop/package.json`
- Modify: `desktop/package-lock.json`
- Modify: `desktop/vite.config.ts`
- Modify: `desktop/.gitignore`

**Interfaces:**
- Consumes: Vite renderer output, compiled Electron main output, and `desktop/backend/{arm64,x64}/dakdash-backend`.
- Produces: `npm run electron:dev`, `npm run package:arm64`, and `npm run package:x64`.

- [ ] **Step 1: Add Electron packaging dependencies and scripts**

  Install Electron, Forge/Packager, universal tooling, and Node types with exact lockfile entries. Configure Vite asset paths to be package-safe.

- [ ] **Step 2: Configure resources and metadata**

  Package both backend executables as extra resources, set product name `DakDash`, bundle identifier `com.dakdash.operator`, minimum macOS target, ASAR packaging, and unsigned output.

- [ ] **Step 3: Verify renderer and Electron compilation**

  Run `npm run build`, `npm run build:main`, and `npm run typecheck`.

### Task 4: Reproducible Universal Build

**Files:**
- Create: `scripts/build_backend_macos.sh`
- Create: `scripts/build_macos_universal.sh`
- Create: `desktop/requirements-build.txt`
- Modify: `.gitignore`
- Modify: `README.md`

**Interfaces:**
- Consumes: native arm64 Python at `/opt/homebrew/bin/python3` and Intel Python discoverable through `arch -x86_64`/configured environment variables.
- Produces: two PyInstaller executables, two functioning Electron `.app` bundles, a merged `DakDash.app`, and `DakDash-macos-universal.zip`.

- [ ] **Step 1: Build backend executables for each architecture**

  Create isolated build virtual environments, install runtime/build requirements, use PyInstaller one-folder mode with `desktop/dist`, and validate each main executable using `file` before packaging.

- [ ] **Step 2: Package Electron for arm64 and x64**

  Build each architecture with both backend resource folders included, then use `@electron/universal` to merge the app bundles without merging the architecture-specific backend resource paths.

- [ ] **Step 3: Add release validation**

  Check Electron's main executable with `lipo -archs`, check each backend executable with `file`, launch both native and Intel backend builds long enough to verify the status endpoint, and zip the universal `.app` while preserving macOS metadata.

- [ ] **Step 4: Document unsigned launch behavior**

  Explain right-click → Open for first launch, the stable OBS URL, supported modern macOS scope, release commands, architecture overrides, and the absence of auto-update without signing.

### Task 5: Full Verification

**Files:**
- Verify all files above without modifying transmission code.

**Interfaces:**
- Consumes: the complete repository and packaged artifacts.
- Produces: fresh test/build evidence and a release artifact path.

- [ ] **Step 1: Run automated tests**

  Run `python3 -m unittest discover -s tests -v`, `python3 -m compileall main.py desktop_backend.py routes services`, `npm test`, `npm run typecheck`, and `npm run build`.

- [ ] **Step 2: Build and inspect the universal application**

  Run `scripts/build_macos_universal.sh`, confirm `arm64 x86_64` in the Electron executable, and confirm matching architecture for both bundled backend executables.

- [ ] **Step 3: Smoke-test packaged runtime**

  Launch the universal app, wait for the status API, fetch operator and viewer pages, verify the bundled fonts/SVG assets respond, and quit the application without leaving a backend process.

- [ ] **Step 4: Review repository scope**

  Confirm `git diff -- transmission services/connection services/synced_service.py services/sport_parsers.py` is empty and no build artifacts, credentials, addresses, caches, or virtual environments are tracked.
