import { spawn, type ChildProcess } from "node:child_process";
import process from "node:process";
import { app, BrowserWindow, dialog } from "electron";
import { terminate_backend, wait_for_backend } from "./backendProcess.js";
import { backend_command, local_server_configuration } from "./runtime.js";

const LOCAL_SERVER = local_server_configuration();

let backend_process: ChildProcess | null = null;
let backend_launch_error: Error | null = null;
let operator_window: BrowserWindow | null = null;
let quit_in_progress = false;

function open_operator_window(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: "#f4f5f7",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  window.setMenuBarVisibility(false);
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.once("ready-to-show", () => window.show());
  window.on("closed", () => {
    if (operator_window === window) operator_window = null;
  });
  void window.loadURL(`${LOCAL_SERVER.base_url}/`);
  return window;
}

async function start_application(): Promise<void> {
  const command = backend_command({
    app_path: app.getAppPath(),
    architecture: process.arch,
    is_packaged: app.isPackaged,
    python_executable: process.env.DAKDASH_PYTHON ?? "python3",
    resources_path: process.resourcesPath
  });

  backend_process = spawn(command.executable, command.args, {
    cwd: command.cwd,
    env: {
      ...process.env,
      DAKDASH_DATA_DIR: app.getPath("userData"),
      DAKDASH_PORT: LOCAL_SERVER.port,
      PYTHONUNBUFFERED: "1"
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  backend_process.once("error", (error) => {
    backend_launch_error = error;
  });
  backend_process.stderr?.on("data", (chunk: Buffer) => process.stderr.write(chunk));

  await wait_for_backend(LOCAL_SERVER.base_url, {
    process_alive: () =>
      backend_launch_error === null &&
      backend_process !== null &&
      backend_process.exitCode === null &&
      backend_process.signalCode === null
  });
  if (
    backend_launch_error !== null ||
    backend_process.exitCode !== null ||
    backend_process.signalCode !== null
  ) {
    throw backend_launch_error ?? new Error("DakDash backend exited during startup");
  }

  operator_window = open_operator_window();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (operator_window === null) {
      operator_window = open_operator_window();
      return;
    }
    if (operator_window.isMinimized()) operator_window.restore();
    operator_window.focus();
  });

  app.whenReady().then(start_application).catch(async (error: unknown) => {
    await terminate_backend(backend_process);
    const message = error instanceof Error ? error.message : String(error);
    dialog.showErrorBox(
      "DakDash could not start",
      `${message}\n\nCheck that no other application is using port ${LOCAL_SERVER.port}.`
    );
    app.quit();
  });

  app.on("activate", () => {
    if (operator_window === null && backend_process?.exitCode === null) {
      operator_window = open_operator_window();
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("before-quit", (event) => {
    if (quit_in_progress || backend_process === null) return;
    event.preventDefault();
    quit_in_progress = true;
    void terminate_backend(backend_process).finally(() => app.quit());
  });
}
