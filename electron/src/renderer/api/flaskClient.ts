import type { ConnectionState, ControlMode, HealthState, Preferences, ScoreboardState, Sport, SportsAndModes } from "@/state/types";

import type {
  ApiEnvelope,
  ApiResult,
  BridgeResult,
  FlaskClient,
  FrontendError,
  HttpMethod,
  RenderTemplateData,
  RenderTemplateRequest,
  SessionInfo,
  StartSessionRequest,
  TemplateData,
  TemplateListData,
  UploadTemplateData,
} from "./types";

interface RequestArgs {
  baseUrl: string;
  method: HttpMethod;
  path: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
}

function normalizeBridgeError(bridge: BridgeResult<unknown>): FrontendError {
  return {
    message: bridge.error?.message || "Request failed",
    code: bridge.error?.code,
    status: bridge.status,
  };
}

function normalizeEnvelopeError(status: number, payload: ApiEnvelope<unknown>): FrontendError {
  return {
    message: payload.message || "Request failed",
    code: payload.error_code,
    status,
  };
}

function parseEnvelope<T>(status: number, raw: unknown): ApiResult<T> {
  if (raw === null || raw === undefined) {
    return {
      ok: false,
      status,
      error: {
        message: "Empty response from backend",
        code: "empty_response",
        status,
      },
    };
  }

  if (typeof raw === "string") {
    return {
      ok: true,
      status,
      data: raw as T,
    };
  }

  const envelope = raw as Partial<ApiEnvelope<T>>;
  if (!Object.prototype.hasOwnProperty.call(envelope, "data")) {
    return {
      ok: false,
      status,
      error: {
        message: "Malformed backend response",
        code: "invalid_envelope",
        status,
      },
    };
  }

  if (envelope.data === null && envelope.error_code) {
    return {
      ok: false,
      status,
      error: normalizeEnvelopeError(status, envelope as ApiEnvelope<unknown>),
    };
  }

  return {
    ok: true,
    status,
    data: envelope.data as T,
  };
}

async function request<T>(args: RequestArgs): Promise<ApiResult<T>> {
  const bridge = await window.dakdashApi.requestJson<ApiEnvelope<T> | string>(args);

  if (!bridge.ok) {
    if (bridge.data && typeof bridge.data === "object" && "error_code" in bridge.data) {
      const envelope = bridge.data as ApiEnvelope<unknown>;
      return {
        ok: false,
        status: bridge.status,
        error: normalizeEnvelopeError(bridge.status, envelope),
      };
    }

    return {
      ok: false,
      status: bridge.status,
      error: normalizeBridgeError(bridge as BridgeResult<unknown>),
    };
  }

  return parseEnvelope<T>(bridge.status, bridge.data);
}

async function upload(baseUrl: string, file: File): Promise<ApiResult<UploadTemplateData>> {
  const buffer = await file.arrayBuffer();
  const bridge = await window.dakdashApi.uploadTemplate<ApiEnvelope<UploadTemplateData>>({
    baseUrl,
    fileName: file.name,
    bytes: Array.from(new Uint8Array(buffer)),
  });

  if (!bridge.ok) {
    if (bridge.data && typeof bridge.data === "object" && "error_code" in bridge.data) {
      return {
        ok: false,
        status: bridge.status,
        error: normalizeEnvelopeError(bridge.status, bridge.data as ApiEnvelope<unknown>),
      };
    }

    return {
      ok: false,
      status: bridge.status,
      error: normalizeBridgeError(bridge as BridgeResult<unknown>),
    };
  }

  return parseEnvelope<UploadTemplateData>(bridge.status, bridge.data);
}

function normalizeSportsAndModes(payload: unknown): SportsAndModes {
  const fallback: SportsAndModes = {
    names: ["football", "basketball", "baseball"],
    modes: {
      football: { synced: true, manual: true },
      basketball: { synced: true, manual: true },
      baseball: { synced: true, manual: true },
    },
  };

  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const raw = payload as { names?: unknown; modes?: unknown };
  const names = Array.isArray(raw.names)
    ? raw.names.filter((x): x is Sport => x === "football" || x === "basketball" || x === "baseball")
    : [];

  if (names.length === 0 || !raw.modes || typeof raw.modes !== "object") {
    return fallback;
  }

  return {
    names,
    modes: raw.modes as SportsAndModes["modes"],
  };
}

export function createFlaskClient(baseUrl: string): FlaskClient {
  return {
    getHealth: () => request<HealthState>({ baseUrl, method: "GET", path: "/api/health" }),

    async getSportsAndModes() {
      const result = await request<{ names: Sport[]; modes: SportsAndModes["modes"] }>({
        baseUrl,
        method: "GET",
        path: "/api/scoreboard-names",
      });

      if (!result.ok) {
        return result;
      }

      return {
        ok: true,
        status: result.status,
        data: normalizeSportsAndModes(result.data),
      };
    },

    startSession: (payload: StartSessionRequest) =>
      request<SessionInfo>({
        baseUrl,
        method: "POST",
        path: "/api/session/start",
        body: payload,
      }),

    stopSession: () => request<{ status: string }>({ baseUrl, method: "POST", path: "/api/session/stop" }),

    getState: () => request<ScoreboardState>({ baseUrl, method: "GET", path: "/api/state" }),

    setControlMode: (mode: ControlMode) =>
      request<ScoreboardState>({
        baseUrl,
        method: "PUT",
        path: "/api/control-mode",
        body: {
          control_mode: mode,
        },
      }),

    manualUpdate: (patch: Record<string, unknown>) =>
      request<ScoreboardState>({
        baseUrl,
        method: "POST",
        path: "/api/manual-update",
        body: {
          score: patch,
        },
      }),

    getConnection: () => request<ConnectionState>({ baseUrl, method: "GET", path: "/api/connection" }),

    listTemplates: () => request<TemplateListData>({ baseUrl, method: "GET", path: "/api/templates" }),

    getTemplate: (name: string) => request<TemplateData>({ baseUrl, method: "GET", path: `/api/templates/${name}` }),

    renderTemplate: (payload: RenderTemplateRequest) =>
      request<RenderTemplateData>({
        baseUrl,
        method: "POST",
        path: "/api/templates/render",
        body: payload,
      }),

    uploadTemplate: (file: File) => upload(baseUrl, file),

    downloadTemplate: (name: string) =>
      request<string>({ baseUrl, method: "GET", path: `/api/templates/${name}/download` }),

    getPreferences: (sport: Sport) => request<Preferences>({ baseUrl, method: "GET", path: `/api/preferences/${sport}` }),

    updatePreferences: (sport: Sport, prefs: Partial<Preferences>) =>
      request<Preferences>({
        baseUrl,
        method: "PUT",
        path: `/api/preferences/${sport}`,
        body: prefs,
      }),
  };
}
