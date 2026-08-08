import type {
  AppearancePayload,
  LaunchSessionInput,
  ManualTransition,
  SessionCapabilities,
  SessionSnapshot,
  SportId
} from "../domain/session";
import { session_snapshot_schema, sport_id_schema } from "../domain/session";
import { get_sport, list_sports } from "../sports/registry";
import type { BackendClient } from "./BackendClient";

interface Subscription {
  session_id: string;
  on_snapshot: (snapshot: SessionSnapshot) => void;
  on_error: (error: Error) => void;
}

const SYNC_FRESHNESS_MS = 2000;
const STORAGE_KEY = "dakdash.fake-backend.v1";

export interface FakeBackendStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): unknown;
  removeItem(key: string): unknown;
}

interface PersistedState {
  active_snapshot: SessionSnapshot | null;
  last_synced_snapshot: SessionSnapshot | null;
  last_synced_at: number | null;
  next_session_number: number;
  appearances: [SportId, AppearancePayload][];
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function default_appearance(sport: SportId): AppearancePayload {
  const home_id = `${sport}-home`;
  const away_id = `${sport}-away`;
  return {
    schema_version: 1,
    sport,
    profiles: [
      {
        id: home_id,
        display_name: "Home",
        abbreviation: "HOME",
        light: "#919191",
        dark: "#004285",
        text: "#ffffff"
      },
      {
        id: away_id,
        display_name: "Away",
        abbreviation: "AWAY",
        light: "#dcdcdc",
        dark: "#b2b2b2",
        text: "#004285"
      }
    ],
    appearance: {
      sport,
      home_profile_id: home_id,
      away_profile_id: away_id,
      token_overrides: {}
    }
  };
}

export class FakeBackendClient implements BackendClient {
  viewer_heartbeat_count = 0;

  private active_snapshot: SessionSnapshot | null = null;
  private last_synced_snapshot: SessionSnapshot | null = null;
  private last_synced_at: number | null = null;
  private next_session_number = 1;
  private readonly subscriptions = new Set<Subscription>();
  private readonly appearances = new Map<SportId, AppearancePayload>();

  constructor(private readonly storage?: FakeBackendStorage) {
    this.restore();
  }

  get active_subscription_count(): number {
    return this.subscriptions.size;
  }

  async list_capabilities(signal?: AbortSignal): Promise<readonly SessionCapabilities[]> {
    signal?.throwIfAborted();
    return Object.freeze(
      list_sports().map((sport) => ({
        sport: sport.id,
        display_name: sport.display_name,
        supported_sources: Object.freeze([...sport.supported_sources])
      }))
    );
  }

  async launch_session(
    input: LaunchSessionInput,
    signal?: AbortSignal
  ): Promise<SessionSnapshot> {
    signal?.throwIfAborted();
    const sport = get_sport(input.sport);
    if (!sport.supported_sources.includes(input.source)) {
      throw new Error(`${input.source} is not supported for ${input.sport}`);
    }

    const now = new Date().toISOString();
    this.active_snapshot = {
      session: {
        session_id: `session-${this.next_session_number}`,
        sport: input.sport,
        source: input.source,
        control_authority: input.source === "synced" ? "daktronics" : "manual"
      },
      connection: {
        status: "live",
        backend_status: "fake",
        last_update_at: now,
        source_age_ms: 0,
        message: null
      },
      scoreboard: {
        revision: 0,
        fields: clone(sport.initial_score)
      }
    };
    this.next_session_number += 1;

    if (input.source === "synced") {
      this.last_synced_snapshot = clone(this.active_snapshot);
      this.last_synced_at = Date.now();
    } else {
      this.last_synced_snapshot = null;
      this.last_synced_at = null;
    }

    this.persist();

    return clone(this.active_snapshot);
  }

  async stop_session(signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted();
    this.active_snapshot = null;
    this.last_synced_snapshot = null;
    this.last_synced_at = null;
    this.persist();
  }

  async get_active_snapshot(signal?: AbortSignal): Promise<SessionSnapshot> {
    signal?.throwIfAborted();
    return clone(this.require_active());
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
    signal.addEventListener("abort", () => this.subscriptions.delete(subscription), { once: true });
  }

  publish_synced(fields: Record<string, unknown>): SessionSnapshot {
    const current = this.require_active();
    if (current.session.control_authority === "manual") {
      throw new Error("Manual authority blocks synced publication");
    }
    if (current.session.source !== "synced") {
      throw new Error("Active session has no synced source");
    }

    const validated_fields = get_sport(current.session.sport).score_schema.parse(fields);
    this.active_snapshot = this.next_snapshot(current, validated_fields, "daktronics");
    this.last_synced_snapshot = clone(this.active_snapshot);
    this.last_synced_at = Date.now();
    this.persist();
    this.emit(this.active_snapshot);
    return clone(this.active_snapshot);
  }

  async take_manual_control(
    expected_revision: number,
    signal?: AbortSignal
  ): Promise<SessionSnapshot> {
    signal?.throwIfAborted();
    const current = this.require_active();
    this.assert_revision(current, expected_revision);
    if (current.session.source !== "synced" || current.session.control_authority !== "daktronics") {
      throw new Error("Manual takeover is unavailable");
    }

    this.active_snapshot = this.next_snapshot(current, current.scoreboard.fields, "manual");
    this.persist();
    this.emit(this.active_snapshot);
    return clone(this.active_snapshot);
  }

  async return_to_sync(
    expected_revision: number,
    signal?: AbortSignal
  ): Promise<SessionSnapshot> {
    signal?.throwIfAborted();
    const current = this.require_active();
    this.assert_revision(current, expected_revision);
    if (current.session.source !== "synced" || current.session.control_authority !== "manual") {
      throw new Error("Return to sync is unavailable");
    }
    if (
      this.last_synced_snapshot === null ||
      this.last_synced_at === null ||
      Date.now() - this.last_synced_at > SYNC_FRESHNESS_MS
    ) {
      throw new Error("Synced state is stale");
    }

    this.active_snapshot = this.next_snapshot(
      current,
      this.last_synced_snapshot.scoreboard.fields,
      "daktronics"
    );
    this.last_synced_snapshot = clone(this.active_snapshot);
    this.last_synced_at = Date.now();
    this.persist();
    this.emit(this.active_snapshot);
    return clone(this.active_snapshot);
  }

  async submit_manual_transition(
    transition: ManualTransition,
    signal?: AbortSignal
  ): Promise<SessionSnapshot> {
    signal?.throwIfAborted();
    const current = this.require_active();
    if (current.session.session_id !== transition.session_id) throw new Error("Session conflict");
    this.assert_revision(current, transition.expected_revision);
    if (current.session.control_authority !== "manual") {
      throw new Error("Manual authority is required");
    }

    const fields = get_sport(current.session.sport).score_schema.parse(transition.fields);
    this.active_snapshot = this.next_snapshot(current, fields, "manual");
    this.persist();
    this.emit(this.active_snapshot);
    return clone(this.active_snapshot);
  }

  async load_appearance(sport: SportId, signal?: AbortSignal): Promise<AppearancePayload> {
    signal?.throwIfAborted();
    return clone(this.appearances.get(sport) ?? default_appearance(sport));
  }

  async save_appearance(
    payload: AppearancePayload,
    signal?: AbortSignal
  ): Promise<AppearancePayload> {
    signal?.throwIfAborted();
    this.appearances.set(payload.sport, clone(payload));
    this.persist();
    return clone(payload);
  }

  async record_viewer_heartbeat(session_id: string, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted();
    if (this.require_active().session.session_id !== session_id) throw new Error("Session conflict");
    this.viewer_heartbeat_count += 1;
  }

  private require_active(): SessionSnapshot {
    if (this.active_snapshot === null) throw new Error("No active session");
    return this.active_snapshot;
  }

  private assert_revision(snapshot: SessionSnapshot, expected_revision: number): void {
    if (snapshot.scoreboard.revision !== expected_revision) throw new Error("Revision conflict");
  }

  private next_snapshot(
    current: SessionSnapshot,
    fields: Record<string, unknown>,
    control_authority: "daktronics" | "manual"
  ): SessionSnapshot {
    return {
      ...clone(current),
      session: { ...current.session, control_authority },
      connection: {
        ...current.connection,
        status: "live",
        last_update_at: new Date().toISOString(),
        source_age_ms: 0,
        message: null
      },
      scoreboard: {
        revision: current.scoreboard.revision + 1,
        fields: clone(fields)
      }
    };
  }

  private emit(snapshot: SessionSnapshot): void {
    for (const subscription of this.subscriptions) {
      if (subscription.session_id === snapshot.session.session_id) {
        subscription.on_snapshot(clone(snapshot));
      }
    }
  }

  private persist(): void {
    if (this.storage === undefined) return;
    const state: PersistedState = {
      active_snapshot: this.active_snapshot,
      last_synced_snapshot: this.last_synced_snapshot,
      last_synced_at: this.last_synced_at,
      next_session_number: this.next_session_number,
      appearances: [...this.appearances.entries()]
    };
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Development persistence must never interrupt live controls.
    }
  }

  private restore(): void {
    if (this.storage === undefined) return;
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (raw === null) return;
      const candidate = JSON.parse(raw) as Partial<PersistedState>;
      this.active_snapshot =
        candidate.active_snapshot === null || candidate.active_snapshot === undefined
          ? null
          : session_snapshot_schema.parse(candidate.active_snapshot);
      this.last_synced_snapshot =
        candidate.last_synced_snapshot === null || candidate.last_synced_snapshot === undefined
          ? null
          : session_snapshot_schema.parse(candidate.last_synced_snapshot);
      this.last_synced_at =
        typeof candidate.last_synced_at === "number" ? candidate.last_synced_at : null;
      this.next_session_number =
        typeof candidate.next_session_number === "number" && candidate.next_session_number > 0
          ? Math.floor(candidate.next_session_number)
          : 1;
      if (Array.isArray(candidate.appearances)) {
        for (const entry of candidate.appearances) {
          if (!Array.isArray(entry) || entry.length !== 2) continue;
          const sport = sport_id_schema.safeParse(entry[0]);
          const payload = entry[1];
          if (
            sport.success &&
            payload !== null &&
            typeof payload === "object" &&
            (payload as AppearancePayload).sport === sport.data
          ) {
            this.appearances.set(sport.data, clone(payload as AppearancePayload));
          }
        }
      }
    } catch {
      this.active_snapshot = null;
      this.last_synced_snapshot = null;
      this.last_synced_at = null;
      this.next_session_number = 1;
      this.appearances.clear();
      try {
        this.storage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore unavailable development storage.
      }
    }
  }
}
