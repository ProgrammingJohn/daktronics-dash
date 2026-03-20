export type Sport = "baseball" | "basketball" | "football";
export type ControlMode = "manual" | "live";

export interface Preferences {
  home_team_name: string;
  home_team_light: string;
  home_team_dark: string;
  home_team_text: string;
  away_team_name: string;
  away_team_light: string;
  away_team_dark: string;
  away_team_text: string;
}

export interface ScoreClock {
  minutes: string | number;
  seconds: string | number;
}

export interface ScoreboardState {
  sport?: Sport;
  home_score?: number;
  away_score?: number;
  period?: number | string;
  clock?: ScoreClock;
  clock_text?: string;
  possession?: "home" | "away" | string;
  home_possesion?: boolean;
  down?: number;
  yards_to_go?: number;
  yards?: number;
  home_fouls?: number;
  away_fouls?: number;
  home_bonus?: boolean;
  away_bonus?: boolean;
  home_timeouts?: number;
  away_timeouts?: number;
  balls?: number;
  strikes?: number;
  outs?: number;
  inning?: number;
  innings?: number;
  inning_half?: "top" | "bot" | string;
  inning_text?: string;
  strikes_and_balls?: string;
  out_text?: string;
  base_one?: boolean;
  base_two?: boolean;
  base_three?: boolean;
  down_text?: string;
  source?: "manual" | "esp32" | string;
  control_mode?: ControlMode | string;
  connection_status?: string;
  raw_source_data?: unknown;
  last_update_time?: string;
  [key: string]: unknown;
}

export interface ConnectionState {
  status: string;
  protocol_mode?: string | null;
  esp_ip?: string | null;
  esp_port?: number | null;
  last_packet_time?: string | null;
  last_error?: string | null;
  device_id?: string | null;
  reconnect_attempts?: number;
}

export interface HealthState {
  status: string;
  session_running?: boolean;
  sport?: string | null;
  control_mode?: string | null;
  connection_status?: string | null;
  protocol_mode?: string | null;
}

export interface SportsAndModes {
  names: Sport[];
  modes: Record<Sport, { synced: boolean; manual: boolean }>;
}

export interface AppState {
  wizardStep: 1 | 2 | 3 | 4;
  selectedSport: Sport | null;
  selectedTemplate: string | null;
  templates: string[];
  sportsAndModes: SportsAndModes | null;
  preferencesDraft: Preferences;
  controlMode: ControlMode;
  espIp: string;
  espPort: string;
  backendBaseUrl: string;
  sessionStarted: boolean;
  scoreState: ScoreboardState | null;
  connectionState: ConnectionState | null;
  healthState: HealthState | null;
  pingMs: number | null;
  renderedSvg: string;
  isLoading: boolean;
  lastError: string | null;
  warnings: string[];
}

export type AppAction =
  | { type: "SET_STEP"; step: 1 | 2 | 3 | 4 }
  | { type: "SET_SPORT"; sport: Sport }
  | { type: "SET_TEMPLATE"; template: string }
  | { type: "SET_TEMPLATES"; templates: string[] }
  | { type: "SET_SPORTS_AND_MODES"; payload: SportsAndModes }
  | { type: "SET_PREFERENCES"; payload: Partial<Preferences> }
  | { type: "SET_CONTROL_MODE"; mode: ControlMode }
  | {
      type: "SET_CONNECTION_INPUTS";
      espIp?: string;
      espPort?: string;
      backendBaseUrl?: string;
    }
  | { type: "SET_SESSION_STARTED"; started: boolean }
  | { type: "SET_SCORE_STATE"; score: ScoreboardState | null }
  | { type: "SET_CONNECTION_STATE"; connection: ConnectionState | null }
  | { type: "SET_HEALTH_STATE"; health: HealthState | null; pingMs?: number | null }
  | { type: "SET_RENDERED_SVG"; svg: string }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_ERROR"; message: string | null }
  | { type: "SET_WARNINGS"; warnings: string[] }
  | { type: "RESET_AFTER_STOP" };
