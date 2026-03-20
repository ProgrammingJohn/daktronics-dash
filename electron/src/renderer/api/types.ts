import type { ConnectionState, ControlMode, HealthState, Preferences, ScoreboardState, Sport, SportsAndModes } from "@/state/types";

export interface ApiEnvelope<T> {
  message: string | null;
  data: T | null;
  error_code?: string;
}

export interface FrontendError {
  message: string;
  code?: string;
  status?: number;
}

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: FrontendError;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestJsonArgs {
  baseUrl: string;
  method: HttpMethod;
  path: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
}

export interface UploadTemplateArgs {
  baseUrl: string;
  fileName: string;
  bytes: number[];
}

export interface BridgeResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

export interface SessionInfo {
  sport: Sport;
  control_mode: ControlMode;
  connection: ConnectionState;
}

export interface TemplateListData {
  templates: string[];
}

export interface TemplateData {
  name: string;
  svg: string;
}

export interface RenderTemplateData {
  svg: string;
}

export interface UploadTemplateData {
  filename: string;
}

export interface StartSessionRequest {
  sport: Sport;
  control_mode: ControlMode;
  esp_ip?: string;
  esp_port?: number;
}

export interface RenderTemplateRequest {
  template: string;
  values: Record<string, unknown>;
  css_vars?: Record<string, unknown>;
}

export interface FlaskClient {
  getHealth: () => Promise<ApiResult<HealthState>>;
  getSportsAndModes: () => Promise<ApiResult<SportsAndModes>>;
  startSession: (payload: StartSessionRequest) => Promise<ApiResult<SessionInfo>>;
  stopSession: () => Promise<ApiResult<{ status: string }>>;
  getState: () => Promise<ApiResult<ScoreboardState>>;
  setControlMode: (mode: ControlMode) => Promise<ApiResult<ScoreboardState>>;
  manualUpdate: (patch: Record<string, unknown>) => Promise<ApiResult<ScoreboardState>>;
  getConnection: () => Promise<ApiResult<ConnectionState>>;
  listTemplates: () => Promise<ApiResult<TemplateListData>>;
  getTemplate: (name: string) => Promise<ApiResult<TemplateData>>;
  renderTemplate: (payload: RenderTemplateRequest) => Promise<ApiResult<RenderTemplateData>>;
  uploadTemplate: (file: File) => Promise<ApiResult<UploadTemplateData>>;
  downloadTemplate: (name: string) => Promise<ApiResult<string>>;
  getPreferences: (sport: Sport) => Promise<ApiResult<Preferences>>;
  updatePreferences: (sport: Sport, prefs: Partial<Preferences>) => Promise<ApiResult<Preferences>>;
}
