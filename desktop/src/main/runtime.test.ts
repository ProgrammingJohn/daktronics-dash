import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  backend_command,
  local_server_configuration,
  operator_window_configuration
} from "./runtime";

describe("backend_command", () => {
  test("launches the matching bundled backend in a packaged app", () => {
    expect(
      backend_command({
        app_path: "/Applications/DakDash.app/Contents/Resources/app.asar",
        architecture: "arm64",
        is_packaged: true,
        python_executable: "unused",
        resources_path: "/Applications/DakDash.app/Contents/Resources"
      })
    ).toEqual({
      args: [],
      cwd: "/Applications/DakDash.app/Contents/Resources",
      executable: path.join(
        "/Applications/DakDash.app/Contents/Resources",
        "backend",
        "arm64",
        "dakdash-backend",
        "dakdash-backend"
      )
    });
  });

  test("launches desktop_backend.py from the repository during development", () => {
    expect(
      backend_command({
        app_path: "/work/daktronics-dash/desktop",
        architecture: "arm64",
        is_packaged: false,
        python_executable: "/work/daktronics-dash/.venv/bin/python",
        resources_path: "/unused"
      })
    ).toEqual({
      args: ["/work/daktronics-dash/desktop_backend.py"],
      cwd: "/work/daktronics-dash",
      executable: "/work/daktronics-dash/.venv/bin/python"
    });
  });
});

describe("local_server_configuration", () => {
  test("keeps Electron and the backend on the dedicated OBS port", () => {
    expect(local_server_configuration()).toEqual({
      base_url: "http://127.0.0.1:58321",
      port: "58321"
    });
  });
});

describe("operator_window_configuration", () => {
  test("opens compactly and permits a smaller operator window", () => {
    expect(operator_window_configuration()).toEqual({
      width: 1100,
      height: 680,
      minWidth: 860,
      minHeight: 520
    });
  });
});
