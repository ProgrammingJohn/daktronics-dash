import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ErrorBanner } from "@/components/ErrorBanner";
import { WizardShell } from "@/components/WizardShell";
import { createFlaskClient } from "@/api/flaskClient";
import { useAppState } from "@/state/AppStateContext";
import { Step1SportSetup } from "@/steps/Step1SportSetup";
import { Step2TemplateCustomize } from "@/steps/Step2TemplateCustomize";
import { Step3ConnectionSetup } from "@/steps/Step3ConnectionSetup";
import { Step4Dashboard } from "@/steps/Step4Dashboard";
import type { ControlMode, ScoreboardState, Sport } from "@/state/types";
import { buildRenderValues, buildSampleValues } from "@/utils/scoreFormat";
import { isValidBackendUrl, isValidEspHost, isValidPort } from "@/utils/validators";

function sportTemplateFallback(sport: Sport | null): string | null {
  if (!sport) {
    return null;
  }
  return `${sport}.svg`;
}

export default function App(): JSX.Element {
  const { state, dispatch } = useAppState();
  const client = useMemo(() => createFlaskClient(state.backendBaseUrl), [state.backendBaseUrl]);

  const pollingRef = useRef<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const selectedSport = state.selectedSport;

  const setError = useCallback(
    (message: string | null) => {
      dispatch({ type: "SET_ERROR", message });
    },
    [dispatch],
  );

  const loadBootstrapData = useCallback(async () => {
    dispatch({ type: "SET_LOADING", loading: true });

    const started = performance.now();
    const [sportsResult, healthResult] = await Promise.all([client.getSportsAndModes(), client.getHealth()]);
    const pingMs = Math.round(performance.now() - started);

    if (sportsResult.ok && sportsResult.data) {
      dispatch({ type: "SET_SPORTS_AND_MODES", payload: sportsResult.data });
    } else {
      setError(sportsResult.error?.message || "Failed to load supported sports.");
    }

    if (healthResult.ok && healthResult.data) {
      dispatch({ type: "SET_HEALTH_STATE", health: healthResult.data, pingMs });
    } else {
      dispatch({
        type: "SET_HEALTH_STATE",
        health: {
          status: "unreachable",
        },
        pingMs,
      });
    }

    dispatch({ type: "SET_LOADING", loading: false });
  }, [client, dispatch, setError]);

  const renderPreview = useCallback(
    async (scoreOverride?: ScoreboardState | null) => {
      if (!selectedSport) {
        return;
      }

      const templateName = state.selectedTemplate || sportTemplateFallback(selectedSport);
      if (!templateName) {
        return;
      }

      const values = scoreOverride
        ? buildRenderValues(scoreOverride, selectedSport)
        : buildSampleValues(selectedSport);

      setPreviewLoading(true);
      setPreviewError(null);

      const renderResult = await client.renderTemplate({
        template: templateName,
        values,
        css_vars: state.preferencesDraft,
      });

      if (!renderResult.ok || !renderResult.data) {
        setPreviewLoading(false);
        const message = renderResult.error?.message || "Failed to render SVG preview.";
        setPreviewError(message);
        setError(message);
        return;
      }

      dispatch({ type: "SET_RENDERED_SVG", svg: renderResult.data.svg });
      setPreviewLoading(false);
    },
    [client, dispatch, selectedSport, setError, state.preferencesDraft, state.selectedTemplate],
  );

  const refreshRuntime = useCallback(async (options?: { includeState?: boolean }) => {
    if (!state.sessionStarted) {
      return;
    }

    const includeState = options?.includeState ?? state.controlMode === "live";
    const started = performance.now();
    const [stateResult, connectionResult, healthResult] = await Promise.all([
      includeState ? client.getState() : Promise.resolve(undefined),
      client.getConnection(),
      client.getHealth(),
    ]);
    const pingMs = Math.round(performance.now() - started);

    const warnings: string[] = [];

    if (stateResult?.ok && stateResult.data) {
      dispatch({ type: "SET_SCORE_STATE", score: stateResult.data });
      await renderPreview(stateResult.data);
    }

    if (connectionResult.ok && connectionResult.data) {
      dispatch({ type: "SET_CONNECTION_STATE", connection: connectionResult.data });
      const status = connectionResult.data.status;
      if (state.controlMode === "live" && status !== "connected") {
        warnings.push(`Live updates are not healthy (connection: ${status}).`);
      }
      if (connectionResult.data.protocol_mode === "legacy") {
        warnings.push("ESP32 is in legacy protocol mode (no ACK/retry guarantees).");
      }
    }

    if (healthResult.ok && healthResult.data) {
      dispatch({ type: "SET_HEALTH_STATE", health: healthResult.data, pingMs });
    }

    if (includeState && stateResult && !stateResult.ok) {
      setError(stateResult.error?.message || "Failed to fetch score state.");
    }

    if (!connectionResult.ok) {
      setError(connectionResult.error?.message || "Failed to fetch connection status.");
    }

    if (!healthResult.ok) {
      warnings.push("Backend health check failed.");
    }

    dispatch({ type: "SET_WARNINGS", warnings });
  }, [client, dispatch, renderPreview, setError, state.controlMode, state.sessionStarted]);

  const loadStep2Data = useCallback(async () => {
    if (!selectedSport) {
      return;
    }

    dispatch({ type: "SET_LOADING", loading: true });

    const [templatesResult, prefsResult] = await Promise.all([client.listTemplates(), client.getPreferences(selectedSport)]);

    if (templatesResult.ok && templatesResult.data) {
      const templates = templatesResult.data.templates;
      dispatch({ type: "SET_TEMPLATES", templates });

      if (!state.selectedTemplate || !templates.includes(state.selectedTemplate)) {
        const fallback = sportTemplateFallback(selectedSport);
        if (fallback && templates.includes(fallback)) {
          dispatch({ type: "SET_TEMPLATE", template: fallback });
        } else if (templates.length > 0) {
          dispatch({ type: "SET_TEMPLATE", template: templates[0] });
        }
      }
    } else {
      setError(templatesResult.error?.message || "Failed to load template list.");
    }

    if (prefsResult.ok && prefsResult.data) {
      dispatch({ type: "SET_PREFERENCES", payload: prefsResult.data });
    } else {
      setError(prefsResult.error?.message || "Failed to load sport preferences.");
    }

    dispatch({ type: "SET_LOADING", loading: false });
  }, [client, dispatch, selectedSport, setError, state.selectedTemplate]);

  useEffect(() => {
    void loadBootstrapData();
  }, [loadBootstrapData]);

  useEffect(() => {
    if (state.wizardStep === 2 && selectedSport) {
      void loadStep2Data();
    }
  }, [loadStep2Data, selectedSport, state.wizardStep]);

  useEffect(() => {
    if (state.wizardStep !== 2 && state.wizardStep !== 4) {
      return;
    }

    if (!selectedSport || !state.selectedTemplate) {
      return;
    }

    if (state.wizardStep === 4) {
      void renderPreview(state.scoreState);
      return;
    }

    void renderPreview(null);
  }, [
    renderPreview,
    selectedSport,
    state.preferencesDraft,
    state.scoreState,
    state.selectedTemplate,
    state.wizardStep,
  ]);

  useEffect(() => {
    if (state.wizardStep !== 4 || !state.sessionStarted) {
      if (pollingRef.current !== null) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    void refreshRuntime();

    pollingRef.current = window.setInterval(() => {
      void refreshRuntime();
    }, 1500);

    return () => {
      if (pollingRef.current !== null) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [refreshRuntime, state.sessionStarted, state.wizardStep]);

  const handleStartSession = useCallback(async () => {
    if (!selectedSport) {
      setError("Choose a sport before starting a session.");
      return;
    }

    if (!isValidBackendUrl(state.backendBaseUrl)) {
      setError("Backend URL is invalid.");
      return;
    }

    const payload: {
      sport: Sport;
      control_mode: ControlMode;
      esp_ip?: string;
      esp_port?: number;
    } = {
      sport: selectedSport,
      control_mode: state.controlMode,
    };

    if (state.controlMode === "live") {
      if (!isValidEspHost(state.espIp)) {
        setError("Enter a valid ESP32 IP/hostname for live mode.");
        return;
      }
      if (!isValidPort(state.espPort)) {
        setError("Enter a valid ESP32 port for live mode.");
        return;
      }

      payload.esp_ip = state.espIp.trim();
      payload.esp_port = Number(state.espPort);
    }

    dispatch({ type: "SET_LOADING", loading: true });

    const result = await client.startSession(payload);
    dispatch({ type: "SET_LOADING", loading: false });

    if (!result.ok) {
      setError(result.error?.message || "Failed to start session.");
      return;
    }

    dispatch({ type: "SET_SESSION_STARTED", started: true });
    dispatch({ type: "SET_STEP", step: 4 });
    setError(null);
    await refreshRuntime({ includeState: true });
  }, [
    client,
    dispatch,
    refreshRuntime,
    selectedSport,
    setError,
    state.backendBaseUrl,
    state.controlMode,
    state.espIp,
    state.espPort,
  ]);

  const handleStopSession = useCallback(async () => {
    const result = await client.stopSession();
    if (!result.ok) {
      setError(result.error?.message || "Failed to stop session.");
      return;
    }

    dispatch({ type: "RESET_AFTER_STOP" });
    setError(null);
    dispatch({ type: "SET_RENDERED_SVG", svg: "" });
  }, [client, dispatch, setError]);

  const handleControlModeSwitch = useCallback(
    async (mode: ControlMode) => {
      dispatch({ type: "SET_CONTROL_MODE", mode });

      if (!state.sessionStarted || state.wizardStep !== 4) {
        return;
      }

      const result = await client.setControlMode(mode);
      if (!result.ok) {
        setError(result.error?.message || "Failed to switch mode.");
        return;
      }

      if (result.data) {
        dispatch({ type: "SET_SCORE_STATE", score: result.data });
        await renderPreview(result.data);
      }

      await refreshRuntime();
      setError(null);
    },
    [client, dispatch, refreshRuntime, renderPreview, setError, state.sessionStarted, state.wizardStep],
  );

  const handleManualUpdate = useCallback(
    async (patch: Record<string, unknown>) => {
      if (state.controlMode !== "manual") {
        setError("Manual updates are disabled in live mode.");
        return;
      }

      const result = await client.manualUpdate(patch);
      if (!result.ok) {
        setError(result.error?.message || "Manual update failed.");
        if (result.error?.code === "mode_conflict") {
          await refreshRuntime();
        }
        return;
      }

      if (result.data) {
        dispatch({ type: "SET_SCORE_STATE", score: result.data });
        await renderPreview(result.data);
      }
      setError(null);
    },
    [client, dispatch, refreshRuntime, renderPreview, setError, state.controlMode],
  );

  const handleUploadTemplate = useCallback(
    async (file: File) => {
      const result = await client.uploadTemplate(file);
      if (!result.ok) {
        setError(result.error?.message || "Template upload failed.");
        return;
      }

      await loadStep2Data();
      if (result.data?.filename) {
        dispatch({ type: "SET_TEMPLATE", template: result.data.filename });
      }
      setError(null);
      await renderPreview(null);
    },
    [client, dispatch, loadStep2Data, renderPreview, setError],
  );

  const handleDownloadTemplate = useCallback(async () => {
    if (!state.selectedTemplate) {
      setError("Select a template to download.");
      return;
    }

    const result = await client.downloadTemplate(state.selectedTemplate);
    if (!result.ok || !result.data) {
      setError(result.error?.message || "Template download failed.");
      return;
    }

    const blob = new Blob([result.data], { type: "image/svg+xml" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = state.selectedTemplate;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  }, [client, setError, state.selectedTemplate]);

  const handleSavePreferences = useCallback(async () => {
    if (!selectedSport) {
      setError("Choose a sport before saving preferences.");
      return;
    }

    const result = await client.updatePreferences(selectedSport, state.preferencesDraft);
    if (!result.ok) {
      setError(result.error?.message || "Failed to save preferences.");
      return;
    }

    setError(null);
    await renderPreview(null);
  }, [client, renderPreview, selectedSport, setError, state.preferencesDraft]);

  const handleNext = useCallback(async () => {
    if (state.wizardStep === 1) {
      if (!selectedSport) {
        setError("Select a sport to continue.");
        return;
      }
      dispatch({ type: "SET_STEP", step: 2 });
      setError(null);
      return;
    }

    if (state.wizardStep === 2) {
      if (!state.selectedTemplate) {
        setError("Select an SVG template to continue.");
        return;
      }
      dispatch({ type: "SET_STEP", step: 3 });
      setError(null);
      return;
    }

    if (state.wizardStep === 3) {
      await handleStartSession();
    }
  }, [
    dispatch,
    handleStartSession,
    selectedSport,
    setError,
    state.selectedTemplate,
    state.wizardStep,
  ]);

  const handleBack = useCallback(async () => {
    if (state.wizardStep === 4) {
      await handleStopSession();
      return;
    }

    if (state.wizardStep === 3) {
      dispatch({ type: "SET_STEP", step: 2 });
      return;
    }

    if (state.wizardStep === 2) {
      dispatch({ type: "SET_STEP", step: 1 });
      return;
    }
  }, [dispatch, handleStopSession, state.wizardStep]);

  const canNext =
    state.wizardStep === 1
      ? Boolean(selectedSport)
      : state.wizardStep === 2
        ? Boolean(state.selectedTemplate)
        : state.wizardStep === 3
          ? true
          : false;

  const nextLabel = state.wizardStep === 3 ? "Start Session" : "Next";
  const backLabel = state.wizardStep === 4 ? "Stop & Back" : "Back";

  return (
    <div className="app-root">
      <ErrorBanner
        error={state.lastError}
        warnings={state.warnings}
        onDismissError={() => dispatch({ type: "SET_ERROR", message: null })}
      />

      <WizardShell
        step={state.wizardStep}
        onBack={state.wizardStep > 1 ? () => void handleBack() : undefined}
        onNext={state.wizardStep < 4 ? () => void handleNext() : undefined}
        canBack={state.wizardStep > 1}
        canNext={canNext}
        nextLabel={nextLabel}
        backLabel={backLabel}
        isBusy={state.isLoading}
      >
        {state.wizardStep === 1 ? (
          <Step1SportSetup
            selectedSport={selectedSport}
            sportsAndModes={state.sportsAndModes}
            health={state.healthState}
            onSelectSport={(sport) => dispatch({ type: "SET_SPORT", sport })}
            onRefreshHealth={() => void loadBootstrapData()}
          />
        ) : null}

        {state.wizardStep === 2 ? (
          <Step2TemplateCustomize
            selectedSport={selectedSport}
            templates={state.templates}
            selectedTemplate={state.selectedTemplate}
            preferences={state.preferencesDraft}
            renderedSvg={state.renderedSvg}
            previewLoading={previewLoading}
            previewError={previewError}
            onSelectTemplate={(template) => dispatch({ type: "SET_TEMPLATE", template })}
            onPreferenceChange={(key, value) => dispatch({ type: "SET_PREFERENCES", payload: { [key]: value } })}
            onUploadTemplate={(file) => void handleUploadTemplate(file)}
            onDownloadTemplate={() => void handleDownloadTemplate()}
            onSavePreferences={() => void handleSavePreferences()}
            onRefreshPreview={() => void renderPreview(null)}
          />
        ) : null}

        {state.wizardStep === 3 ? (
          <Step3ConnectionSetup
            controlMode={state.controlMode}
            espIp={state.espIp}
            espPort={state.espPort}
            backendBaseUrl={state.backendBaseUrl}
            onControlModeChange={(mode) => dispatch({ type: "SET_CONTROL_MODE", mode })}
            onInputChange={(patch) => dispatch({ type: "SET_CONNECTION_INPUTS", ...patch })}
          />
        ) : null}

        {state.wizardStep === 4 && selectedSport ? (
          <Step4Dashboard
            selectedSport={selectedSport}
            controlMode={state.controlMode}
            scoreState={state.scoreState}
            connectionState={state.connectionState}
            healthState={state.healthState}
            backendBaseUrl={state.backendBaseUrl}
            pingMs={state.pingMs}
            sessionStarted={state.sessionStarted}
            renderedSvg={state.renderedSvg}
            previewLoading={previewLoading}
            previewError={previewError}
            onRefresh={() => void refreshRuntime({ includeState: true })}
            onStopSession={() => void handleStopSession()}
            onControlModeChange={(mode) => void handleControlModeSwitch(mode)}
            onManualUpdate={(patch) => void handleManualUpdate(patch)}
          />
        ) : null}
      </WizardShell>
    </div>
  );
}
