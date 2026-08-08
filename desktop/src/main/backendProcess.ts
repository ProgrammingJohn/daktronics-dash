import path from "node:path";
import type { ChildProcess } from "node:child_process";

const STATUS_PATH = "/api/scoreboard-service/status";

export interface WaitForBackendOptions {
  attempts?: number;
  delay_ms?: number;
  fetcher?: typeof fetch;
  process_alive?: () => boolean;
}

export function backend_executable(resources_path: string, architecture: string): string {
  if (architecture !== "arm64" && architecture !== "x64") {
    throw new Error(`Unsupported Mac architecture: ${architecture}`);
  }
  return path.join(
    resources_path,
    "backend",
    architecture,
    "dakdash-backend",
    "dakdash-backend"
  );
}

function is_backend_status(candidate: unknown): boolean {
  if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) {
    return false;
  }
  const status = candidate as Record<string, unknown>;
  return (
    typeof status.status === "string" &&
    typeof status.transport === "string" &&
    typeof status.revision === "number"
  );
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function wait_for_backend(
  base_url: string,
  options: WaitForBackendOptions = {}
): Promise<void> {
  const attempts = options.attempts ?? 75;
  const delay_ms = options.delay_ms ?? 200;
  const fetcher = options.fetcher ?? fetch;
  const process_alive = options.process_alive ?? (() => true);
  let last_error: unknown = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (!process_alive()) {
      throw new Error("DakDash backend exited during startup");
    }
    try {
      const response = await fetcher(`${base_url}${STATUS_PATH}`, { cache: "no-store" });
      if (response.ok && is_backend_status(await response.json())) return;
      last_error = new Error(`Unexpected status response (${response.status})`);
    } catch (error) {
      last_error = error;
    }
    if (attempt + 1 < attempts) await delay(delay_ms);
  }

  const detail = last_error instanceof Error ? `: ${last_error.message}` : "";
  throw new Error(`DakDash backend did not become ready at ${base_url}${detail}`);
}

export async function terminate_backend(
  child: ChildProcess | null,
  grace_period_ms = 2000
): Promise<void> {
  if (child === null || child.exitCode !== null || child.signalCode !== null) return;

  let timeout: ReturnType<typeof setTimeout> | undefined;
  const exited = new Promise<boolean>((resolve) => {
    child.once("exit", () => resolve(true));
    timeout = setTimeout(() => resolve(false), grace_period_ms);
  });

  child.kill("SIGTERM");
  const stopped = await exited;
  if (timeout !== undefined) clearTimeout(timeout);
  if (stopped || child.exitCode !== null || child.signalCode !== null) return;

  const killed = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  child.kill("SIGKILL");
  await killed;
}
