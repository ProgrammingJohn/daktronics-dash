import type { ChangeEvent } from "react";

import { ColorField, SelectField, TextField } from "@/components/FormControls";
import { SvgPreview } from "@/components/SvgPreview";
import type { Preferences, Sport } from "@/state/types";

interface Step2TemplateCustomizeProps {
  selectedSport: Sport | null;
  templates: string[];
  selectedTemplate: string | null;
  preferences: Preferences;
  renderedSvg: string;
  previewError?: string | null;
  previewLoading?: boolean;
  onSelectTemplate: (name: string) => void;
  onPreferenceChange: (key: keyof Preferences, value: string) => void;
  onUploadTemplate: (file: File) => void;
  onDownloadTemplate: () => void;
  onSavePreferences: () => void;
  onRefreshPreview: () => void;
}

export function Step2TemplateCustomize({
  selectedSport,
  templates,
  selectedTemplate,
  preferences,
  renderedSvg,
  previewError,
  previewLoading,
  onSelectTemplate,
  onPreferenceChange,
  onUploadTemplate,
  onDownloadTemplate,
  onSavePreferences,
  onRefreshPreview,
}: Step2TemplateCustomizeProps): JSX.Element {
  const templateOptions = templates.map((template) => ({
    value: template,
    label: template,
  }));

  function handleFile(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    onUploadTemplate(file);
    event.target.value = "";
  }

  return (
    <section className="step-layout">
      <h2>Step 2: Template and Style</h2>
      <p>Choose a template, adjust team branding, and preview exactly what OBS will read.</p>

      <div className="grid-two">
        <div className="panel">
          <SelectField
            id="template"
            label="Template"
            value={selectedTemplate || ""}
            options={[
              { value: "", label: templates.length ? "Select a template" : "No templates found" },
              ...templateOptions,
            ]}
            onChange={onSelectTemplate}
          />

          <div className="button-row">
            <label className="button button-ghost" htmlFor="template-upload-input">
              Upload SVG
            </label>
            <input
              id="template-upload-input"
              className="hidden-input"
              type="file"
              accept=".svg,image/svg+xml"
              onChange={handleFile}
            />
            <button type="button" className="button button-ghost" onClick={onDownloadTemplate} disabled={!selectedTemplate}>
              Download
            </button>
            <button type="button" className="button button-ghost" onClick={onRefreshPreview} disabled={!selectedTemplate}>
              Refresh Preview
            </button>
          </div>

          <h3>Team Preferences {selectedSport ? `(${selectedSport})` : ""}</h3>

          <div className="grid-two tight">
            <TextField
              id="home_team_name"
              label="Home Team Name"
              value={preferences.home_team_name}
              onChange={(value) => onPreferenceChange("home_team_name", value)}
            />
            <TextField
              id="away_team_name"
              label="Away Team Name"
              value={preferences.away_team_name}
              onChange={(value) => onPreferenceChange("away_team_name", value)}
            />

            <ColorField
              id="home_team_light"
              label="Home Light"
              value={preferences.home_team_light}
              onChange={(value) => onPreferenceChange("home_team_light", value)}
            />
            <ColorField
              id="home_team_dark"
              label="Home Dark"
              value={preferences.home_team_dark}
              onChange={(value) => onPreferenceChange("home_team_dark", value)}
            />
            <ColorField
              id="home_team_text"
              label="Home Text"
              value={preferences.home_team_text}
              onChange={(value) => onPreferenceChange("home_team_text", value)}
            />

            <ColorField
              id="away_team_light"
              label="Away Light"
              value={preferences.away_team_light}
              onChange={(value) => onPreferenceChange("away_team_light", value)}
            />
            <ColorField
              id="away_team_dark"
              label="Away Dark"
              value={preferences.away_team_dark}
              onChange={(value) => onPreferenceChange("away_team_dark", value)}
            />
            <ColorField
              id="away_team_text"
              label="Away Text"
              value={preferences.away_team_text}
              onChange={(value) => onPreferenceChange("away_team_text", value)}
            />
          </div>

          <div className="button-row">
            <button type="button" className="button" onClick={onSavePreferences} disabled={!selectedSport}>
              Save Preferences
            </button>
          </div>
        </div>

        <div className="panel">
          <h3>SVG Preview</h3>
          <SvgPreview
            svg={renderedSvg}
            loading={previewLoading}
            error={previewError}
            emptyLabel="Choose a template to preview it."
          />
        </div>
      </div>
    </section>
  );
}
