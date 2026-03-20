import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from "react";

import type { AppAction, AppState, Preferences } from "./types";

const defaultPreferences: Preferences = {
  home_team_name: "HOME",
  home_team_light: "#0061ff",
  home_team_dark: "#0042aa",
  home_team_text: "#ffffff",
  away_team_name: "AWAY",
  away_team_light: "#ff4013",
  away_team_dark: "#b51a00",
  away_team_text: "#ffffff",
};

export const initialAppState: AppState = {
  wizardStep: 1,
  selectedSport: null,
  selectedTemplate: null,
  templates: [],
  sportsAndModes: null,
  preferencesDraft: defaultPreferences,
  controlMode: "manual",
  espIp: "",
  espPort: "8000",
  backendBaseUrl: "http://127.0.0.1:5001",
  sessionStarted: false,
  scoreState: null,
  connectionState: null,
  healthState: null,
  pingMs: null,
  renderedSvg: "",
  isLoading: false,
  lastError: null,
  warnings: [],
};

export function appStateReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, wizardStep: action.step };

    case "SET_SPORT":
      return {
        ...state,
        selectedSport: action.sport,
        selectedTemplate: `${action.sport}.svg`,
        scoreState: null,
      };

    case "SET_TEMPLATE":
      return { ...state, selectedTemplate: action.template };

    case "SET_TEMPLATES":
      return { ...state, templates: action.templates };

    case "SET_SPORTS_AND_MODES":
      return { ...state, sportsAndModes: action.payload };

    case "SET_PREFERENCES":
      return {
        ...state,
        preferencesDraft: {
          ...state.preferencesDraft,
          ...action.payload,
        },
      };

    case "SET_CONTROL_MODE":
      return {
        ...state,
        controlMode: action.mode,
        warnings: action.mode === "manual" ? state.warnings.filter((w) => !w.includes("Live updates")) : state.warnings,
      };

    case "SET_CONNECTION_INPUTS":
      return {
        ...state,
        espIp: action.espIp ?? state.espIp,
        espPort: action.espPort ?? state.espPort,
        backendBaseUrl: action.backendBaseUrl ?? state.backendBaseUrl,
      };

    case "SET_SESSION_STARTED":
      return { ...state, sessionStarted: action.started };

    case "SET_SCORE_STATE":
      return { ...state, scoreState: action.score };

    case "SET_CONNECTION_STATE":
      return { ...state, connectionState: action.connection };

    case "SET_HEALTH_STATE":
      return {
        ...state,
        healthState: action.health,
        pingMs: action.pingMs ?? state.pingMs,
      };

    case "SET_RENDERED_SVG":
      return { ...state, renderedSvg: action.svg };

    case "SET_LOADING":
      return { ...state, isLoading: action.loading };

    case "SET_ERROR":
      return {
        ...state,
        lastError: action.message,
      };

    case "SET_WARNINGS":
      return { ...state, warnings: action.warnings };

    case "RESET_AFTER_STOP":
      return {
        ...state,
        sessionStarted: false,
        scoreState: null,
        connectionState: null,
        pingMs: null,
        warnings: [],
        wizardStep: 3,
      };

    default:
      return state;
  }
}

interface AppStateContextValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
}

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined);

export function AppStateProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, dispatch] = useReducer(appStateReducer, initialAppState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error("useAppState must be used inside AppStateProvider");
  }
  return ctx;
}

export function getDefaultPreferences(): Preferences {
  return { ...defaultPreferences };
}
