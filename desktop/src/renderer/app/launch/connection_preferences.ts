import type { SyncedConnectionConfig } from "../../domain/session";

export const CONNECTION_STORAGE_KEY = "dakdash.connection.v1";

export const default_connection: SyncedConnectionConfig = {
  ip: "",
  port: 1234,
  device_id: ""
};

export function load_connection(storage: Storage): SyncedConnectionConfig {
  try {
    const raw = storage.getItem(CONNECTION_STORAGE_KEY);
    if (raw === null) return default_connection;
    const value = JSON.parse(raw) as Partial<SyncedConnectionConfig>;
    return {
      ip: typeof value.ip === "string" ? value.ip : "",
      port:
        typeof value.port === "number" && value.port >= 1 && value.port <= 65535
          ? value.port
          : 1234,
      device_id: typeof value.device_id === "string" ? value.device_id : ""
    };
  } catch {
    return default_connection;
  }
}

export function save_connection(storage: Storage, connection: SyncedConnectionConfig): void {
  storage.setItem(CONNECTION_STORAGE_KEY, JSON.stringify(connection));
}
