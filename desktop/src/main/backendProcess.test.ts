import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { describe, expect, test } from "vitest";
import { backend_executable, terminate_backend, wait_for_backend } from "./backendProcess";

describe("backend_executable", () => {
  test.each([
    ["arm64", "arm64"],
    ["x64", "x64"]
  ] as const)("selects the %s packaged backend", (architecture, directory) => {
    expect(backend_executable("/Applications/DakDash.app/Contents/Resources", architecture)).toBe(
      path.join(
        "/Applications/DakDash.app/Contents/Resources",
        "backend",
        directory,
        "dakdash-backend",
        "dakdash-backend"
      )
    );
  });

  test("rejects an architecture that has no bundled backend", () => {
    expect(() => backend_executable("/tmp/resources", "ia32")).toThrow(
      "Unsupported Mac architecture: ia32"
    );
  });
});

describe("wait_for_backend", () => {
  test("retries failed requests until the DakDash status API is ready", async () => {
    let attempts = 0;
    const fetcher: typeof fetch = async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("connection refused");
      return new Response(
        JSON.stringify({
          status: "DISCONNECTED",
          transport: "none",
          revision: 0
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    await wait_for_backend("http://127.0.0.1:5000", {
      attempts: 3,
      delay_ms: 0,
      fetcher
    });

    expect(attempts).toBe(3);
  });

  test("rejects an unrelated service listening on the DakDash port", async () => {
    const fetcher: typeof fetch = async () =>
      new Response("not DakDash", { status: 200, headers: { "Content-Type": "text/plain" } });

    await expect(
      wait_for_backend("http://127.0.0.1:5000", {
        attempts: 1,
        delay_ms: 0,
        fetcher
      })
    ).rejects.toThrow("DakDash backend did not become ready");
  });

  test("stops retrying when the spawned backend exits", async () => {
    const fetcher: typeof fetch = async () => {
      throw new Error("connection refused");
    };

    await expect(
      wait_for_backend("http://127.0.0.1:5000", {
        attempts: 5,
        delay_ms: 0,
        fetcher,
        process_alive: () => false
      })
    ).rejects.toThrow("DakDash backend exited during startup");
  });
});

describe("terminate_backend", () => {
  test("stops the owned backend child process", async () => {
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      stdio: "ignore"
    });
    await once(child, "spawn");

    await terminate_backend(child, 1000);

    expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
  });
});
