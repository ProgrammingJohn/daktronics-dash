import { z } from "zod";
import {
  discovery_status_schema,
  session_snapshot_schema,
  sport_id_schema,
  type AppearancePayload,
  type ConnectionStatus,
  type LaunchSessionInput,
  type ManualTransition,
  type SessionCapabilities,
  type SessionSnapshot,
  type SportId,
  type SyncedConnectionConfig
} from "../domain/session";
import { get_sport, list_sports } from "../sports/registry";
import type { BackendClient } from "./BackendClient";

const SESSION_STORAGE_KEY = "dakdash.http-session.v1";
const POLL_INTERVAL_MS = 1000;

const backend_status_schema = z.object({
  status: z.enum([
    "LIVE",
    "STALE_SOURCE",
    "WAITING_FOR_CLIENT",
    "DISCONNECTED",
    "INCOMPATIBLE"
  ]),
  transport: z.string(),
  source: z.string(),
  revision: z.number().int().nonnegative(),
  source_age_ms: z.number().nonnegative().nullable(),
  discovery: discovery_status_schema.optional()
});

const backend_scoreboard_name_schema = z.object({
  scoreboard_name: sport_id_schema
});

type BackendStatus = z.infer<typeof backend_status_schema>;
type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): unknown;
  removeItem(key: string): unknown;
}

interface ClientOptions {
  base_url?: string;
  fetcher?: Fetcher;
  storage?: StorageLike | null;
}

interface PersistedSession {
  snapshot: SessionSnapshot;
  connection: SyncedConnectionConfig | null;
}

interface Subscription {
  session_id: string;
  on_snapshot(snapshot: SessionSnapshot): void;
  on_error(error: Error): void;
}

export function map_backend_status(status: BackendStatus["status"]): ConnectionStatus {
  if (status === "LIVE") return "live";
  if (status === "STALE_SOURCE" || status === "WAITING_FOR_CLIENT") return "stale";
  return "disconnected";
}

export function normalize_backend_score(
  sport: SportId,
  candidate: unknown
): Record<string, unknown> {
  if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new Error("Backend returned an invalid score");
  }
  const fields = structuredClone(candidate) as Record<string, unknown>;
  if (sport === "football" && fields.yards === undefined && fields.yards_to_go !== undefined) {
    fields.yards = fields.yards_to_go;
    delete fields.yards_to_go;
  }
  if (
    sport === "basketball" &&
    fields.clock !== null &&
    typeof fields.clock === "object" &&
    !Array.isArray(fields.clock)
  ) {
    const clock = fields.clock as Record<string, unknown>;
    fields.clock = `${Number(clock.minutes)}:${String(Number(clock.seconds)).padStart(2, "0")}`;
  }
  return get_sport(sport).score_schema.parse(fields) as Record<string, unknown>;
}

function status_message(status: BackendStatus["status"]): string | null {
  if (status === "INCOMPATIBLE") return "The connected device ID is incompatible";
  if (status === "DISCONNECTED") return "TCP transport disconnected";
  return null;
}

function default_appearance(sport: SportId): AppearancePayload {
  const home_id = `${sport}-home`;
  const away_id = `${sport}-away`;
  return {
    schema_version: 1,
    sport,
    profiles: [
      { id: home_id, display_name: "Home", abbreviation: "HOME", light: "#919191", dark: "#004285", text: "#ffffff" },
      { id: away_id, display_name: "Away", abbreviation: "AWAY", light: "#dcdcdc", dark: "#b2b2b2", text: "#004285" }
    ],
    appearance: {
      sport,
      home_profile_id: home_id,
      away_profile_id: away_id,
      token_overrides: {}
    }
  };
}

export class FlaskBackendClient implements BackendClient {
  private readonly base_url: string;
  private readonly fetcher: Fetcher;
  private readonly storage: StorageLike | null;
  private active_snapshot: SessionSnapshot | null = null;
  private connection: SyncedConnectionConfig | null = null;
  private readonly subscriptions = new Set<Subscription>();
  private poll_timer: number | null = null;
  private polling = false;

  constructor(options: ClientOptions = {}) {
    this.base_url = options.base_url ?? "";
    this.fetcher = options.fetcher ?? window.fetch.bind(window);
    this.storage = options.storage === undefined ? window.localStorage : options.storage;
    this.restore();
  }

  async list_capabilities(signal?: AbortSignal): Promise<readonly SessionCapabilities[]> {
    signal?.throwIfAborted();
    return list_sports().map((sport) => ({
      sport: sport.id,
      display_name: sport.display_name,
      supported_sources: [...sport.supported_sources]
    }));
  }

  async launch_session(input: LaunchSessionInput, signal?: AbortSignal): Promise<SessionSnapshot> {
    const connection = input.source === "synced" ? input.connection ?? null : null;
    if (input.source === "synced" && connection === null) {
      throw new Error("Synced connection settings are required");
    }
    await this.request("/api/scoreboard-service/start", {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scoreboard: input.sport,
        method: input.source,
        ...(connection ?? {})
      })
    });

    const initial_fields = structuredClone(get_sport(input.sport).initial_score);
    if (input.source === "manual") {
      await this.request("/api/scoreboard-service/update-score", {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: initial_fields })
      });
    }
    this.connection = connection;
    this.active_snapshot = {
      session: {
        session_id: `session-${Date.now()}`,
        sport: input.sport,
        source: input.source,
        control_authority: input.source === "synced" ? "daktronics" : "manual"
      },
      connection: {
        status: "disconnected",
        backend_status: "STARTING",
        last_update_at: null,
        source_age_ms: null,
        message: null,
        transport: input.source === "synced" ? "tcp" : "manual",
        source: input.source === "synced" ? "daktronics" : "manual"
      },
      scoreboard: { revision: 0, fields: initial_fields }
    };
    await this.refresh(signal);
    this.persist();
    return structuredClone(this.require_active());
  }

  async stop_session(signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted();
    this.stop_polling();
    this.subscriptions.clear();
    this.active_snapshot = null;
    this.connection = null;
    try {
      this.storage?.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Local persistence is optional.
    }
  }

  async get_active_snapshot(signal?: AbortSignal): Promise<SessionSnapshot> {
    if (this.active_snapshot === null) {
      return structuredClone(await this.recover_active_session(signal));
    }
    await this.refresh(signal);
    return structuredClone(this.require_active());
  }

  subscribe(
    session_id: string,
    on_snapshot: (snapshot: SessionSnapshot) => void,
    on_error: (error: Error) => void,
    signal: AbortSignal
  ): void {
    signal.throwIfAborted();
    const subscription = { session_id, on_snapshot, on_error };
    this.subscriptions.add(subscription);
    signal.addEventListener(
      "abort",
      () => {
        this.subscriptions.delete(subscription);
        if (this.subscriptions.size === 0) this.stop_polling();
      },
      { once: true }
    );
    if (this.poll_timer === null) {
      this.poll_timer = window.setInterval(() => void this.poll(), POLL_INTERVAL_MS);
    }
  }

  async take_manual_control(expected_revision: number, signal?: AbortSignal): Promise<SessionSnapshot> {
    const current = this.require_revision(expected_revision);
    await this.request("/api/scoreboard-service/start", {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scoreboard: current.session.sport, method: "manual" })
    });
    await this.request("/api/scoreboard-service/update-score", {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: current.scoreboard.fields })
    });
    this.active_snapshot = {
      ...current,
      session: { ...current.session, control_authority: "manual" }
    };
    await this.refresh(signal);
    return structuredClone(this.require_active());
  }

  async return_to_sync(expected_revision: number, signal?: AbortSignal): Promise<SessionSnapshot> {
    const current = this.require_revision(expected_revision);
    if (this.connection === null) throw new Error("Synced connection settings are unavailable");
    await this.request("/api/scoreboard-service/start", {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scoreboard: current.session.sport, method: "synced", ...this.connection })
    });
    this.active_snapshot = {
      ...current,
      session: { ...current.session, control_authority: "daktronics" }
    };
    await this.refresh(signal);
    return structuredClone(this.require_active());
  }

  async retry_sync(signal?: AbortSignal): Promise<SessionSnapshot> {
    const current = this.require_active();
    if (current.session.source !== "synced" || this.connection === null) {
      throw new Error("Synced connection settings are unavailable");
    }
    await this.request("/api/scoreboard-service/start", {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scoreboard: current.session.sport, method: "synced", ...this.connection })
    });
    await this.refresh(signal);
    this.persist();
    return structuredClone(this.require_active());
  }

  async submit_manual_transition(transition: ManualTransition, signal?: AbortSignal): Promise<SessionSnapshot> {
    const current = this.require_revision(transition.expected_revision);
    if (transition.session_id !== current.session.session_id) throw new Error("Session conflict");
    const fields = get_sport(current.session.sport).score_schema.parse(transition.fields);
    await this.request("/api/scoreboard-service/update-score", {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: fields })
    });
    const status = await this.get_status(signal);
    this.active_snapshot = this.with_status(
      { ...current, scoreboard: { revision: status.revision, fields } },
      status,
      true
    );
    this.persist();
    return structuredClone(this.active_snapshot);
  }

  async load_appearance(sport: SportId, signal?: AbortSignal): Promise<AppearancePayload> {
    const defaults = default_appearance(sport);
    const params = new URLSearchParams({ Scoreboard: sport });
    const response = (await this.request(
      `/api/scoreboard-preferences?${params.toString()}`,
      { signal }
    )) as { data?: Record<string, unknown> };
    const preferences = response.data ?? {};
    const home = defaults.profiles[0]!;
    const away = defaults.profiles[1]!;
    home.abbreviation = String(preferences.home_team_name ?? home.abbreviation);
    home.light = String(preferences.home_team_light ?? home.light);
    home.dark = String(preferences.home_team_dark ?? home.dark);
    home.text = String(preferences.home_team_text ?? home.text);
    away.abbreviation = String(preferences.away_team_name ?? away.abbreviation);
    away.light = String(preferences.away_team_light ?? away.light);
    away.dark = String(preferences.away_team_dark ?? away.dark);
    away.text = String(preferences.away_team_text ?? away.text);
    return defaults;
  }

  async save_appearance(payload: AppearancePayload, signal?: AbortSignal): Promise<AppearancePayload> {
    const home = payload.profiles.find((profile) => profile.id === payload.appearance.home_profile_id);
    const away = payload.profiles.find((profile) => profile.id === payload.appearance.away_profile_id);
    if (home === undefined || away === undefined) throw new Error("Appearance references missing teams");
    await this.request("/api/scoreboard-update", {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scoreboard: payload.sport,
        preferences: {
          home_team_name: home.abbreviation,
          home_team_light: home.light,
          home_team_dark: home.dark,
          home_team_text: home.text,
          away_team_name: away.abbreviation,
          away_team_light: away.light,
          away_team_dark: away.dark,
          away_team_text: away.text
        }
      })
    });
    return structuredClone(payload);
  }

  async record_viewer_heartbeat(session_id: string, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted();
    if (this.require_active().session.session_id !== session_id) throw new Error("Session conflict");
  }

  private async poll(): Promise<void> {
    if (this.polling || this.active_snapshot === null) return;
    this.polling = true;
    try {
      const snapshot = await this.refresh();
      for (const subscription of this.subscriptions) {
        if (subscription.session_id === snapshot.session.session_id) {
          subscription.on_snapshot(structuredClone(snapshot));
        }
      }
    } catch (reason) {
      const error = reason instanceof Error ? reason : new Error("Backend polling failed");
      for (const subscription of this.subscriptions) subscription.on_error(error);
    } finally {
      this.polling = false;
    }
  }

  private async refresh(signal?: AbortSignal): Promise<SessionSnapshot> {
    const current = this.require_active();
    const status = await this.get_status(signal);
    let snapshot = current;
    let score_changed = false;
    if (status.revision !== current.scoreboard.revision) {
      try {
        const candidate = await this.request("/api/scoreboard-service/get-score", { signal });
        const fields = normalize_backend_score(current.session.sport, candidate);
        snapshot = { ...current, scoreboard: { revision: status.revision, fields } };
        score_changed = true;
      } catch {
        // Keep the last valid score and retry this revision on the next poll.
      }
    }
    this.active_snapshot = this.with_status(snapshot, status, score_changed);
    this.persist();
    return this.active_snapshot;
  }

  private async recover_active_session(signal?: AbortSignal): Promise<SessionSnapshot> {
    const name_response = await this.request(
      "/api/scoreboard-service/get-scoreboard-name",
      { signal }
    );
    const { scoreboard_name: sport } = backend_scoreboard_name_schema.parse(name_response);
    const status = await this.get_status(signal);
    const backend_is_manual = status.source === "manual";
    let fields = structuredClone(get_sport(sport).initial_score) as Record<string, unknown>;
    let score_loaded = false;

    try {
      const candidate = await this.request("/api/scoreboard-service/get-score", { signal });
      fields = normalize_backend_score(sport, candidate);
      score_loaded = true;
    } catch {
      signal?.throwIfAborted();
      // Before the first serial snapshot the backend has no valid score yet.
    }

    const recovered: SessionSnapshot = {
      session: {
        session_id: `backend-${sport}`,
        sport,
        source: backend_is_manual ? "manual" : "synced",
        control_authority: backend_is_manual ? "manual" : "daktronics"
      },
      connection: {
        status: "disconnected",
        backend_status: status.status,
        last_update_at: null,
        source_age_ms: null,
        message: null,
        transport: status.transport,
        source: status.source,
        discovery: status.discovery
      },
      scoreboard: { revision: status.revision, fields }
    };
    this.active_snapshot = this.with_status(recovered, status, score_loaded);
    this.persist();
    return this.active_snapshot;
  }

  private with_status(snapshot: SessionSnapshot, status: BackendStatus, score_changed: boolean): SessionSnapshot {
    return {
      ...snapshot,
      connection: {
        status: map_backend_status(status.status),
        backend_status: status.status,
        last_update_at: score_changed ? new Date().toISOString() : snapshot.connection.last_update_at,
        source_age_ms: status.source_age_ms,
        message: status_message(status.status),
        transport: status.transport,
        source: status.source,
        discovery: status.discovery ?? snapshot.connection.discovery
      }
    };
  }

  private get_status(signal?: AbortSignal): Promise<BackendStatus> {
    return this.request("/api/scoreboard-service/status", { signal }).then((value) =>
      backend_status_schema.parse(value)
    );
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const response = await this.fetcher(`${this.base_url}${path}`, init);
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (!response.ok) {
      const object = body !== null && typeof body === "object" ? (body as Record<string, unknown>) : {};
      const message = object.error ?? object.message ?? `Backend request failed (${response.status})`;
      throw new Error(String(message));
    }
    return body;
  }

  private require_active(): SessionSnapshot {
    if (this.active_snapshot === null) throw new Error("No active session");
    return this.active_snapshot;
  }

  private require_revision(expected_revision: number): SessionSnapshot {
    const current = this.require_active();
    if (current.scoreboard.revision !== expected_revision) throw new Error("Revision conflict");
    return current;
  }

  private stop_polling(): void {
    if (this.poll_timer !== null) window.clearInterval(this.poll_timer);
    this.poll_timer = null;
  }

  private persist(): void {
    if (this.storage === null || this.active_snapshot === null) return;
    try {
      const value: PersistedSession = { snapshot: this.active_snapshot, connection: this.connection };
      this.storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Local persistence is optional.
    }
  }

  private restore(): void {
    if (this.storage === null) return;
    try {
      const raw = this.storage.getItem(SESSION_STORAGE_KEY);
      if (raw === null) return;
      const value = JSON.parse(raw) as PersistedSession;
      this.active_snapshot = session_snapshot_schema.parse(value.snapshot);
      this.connection = value.connection ?? null;
    } catch {
      this.active_snapshot = null;
      this.connection = null;
      this.storage.removeItem(SESSION_STORAGE_KEY);
    }
  }
}
