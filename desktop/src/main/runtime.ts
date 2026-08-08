import path from "node:path";
import { backend_executable } from "./backendProcess.js";

export interface BackendCommandOptions {
  app_path: string;
  architecture: string;
  is_packaged: boolean;
  python_executable: string;
  resources_path: string;
}

export interface BackendCommand {
  executable: string;
  args: string[];
  cwd: string;
}

export interface LocalServerConfiguration {
  base_url: string;
  port: string;
}

export interface OperatorWindowConfiguration {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
}

export function operator_window_configuration(): OperatorWindowConfiguration {
  return {
    width: 1100,
    height: 680,
    minWidth: 860,
    minHeight: 520
  };
}

export function local_server_configuration(port = 58321): LocalServerConfiguration {
  return {
    base_url: `http://127.0.0.1:${port}`,
    port: String(port)
  };
}

export function backend_command(options: BackendCommandOptions): BackendCommand {
  if (options.is_packaged) {
    return {
      executable: backend_executable(options.resources_path, options.architecture),
      args: [],
      cwd: options.resources_path
    };
  }

  const repository_path = path.resolve(options.app_path, "..");
  return {
    executable: options.python_executable,
    args: [path.join(repository_path, "desktop_backend.py")],
    cwd: repository_path
  };
}
