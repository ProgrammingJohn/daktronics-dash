import path from "node:path";
import { describe, expect, test } from "vitest";
import { backend_command } from "./runtime";

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
