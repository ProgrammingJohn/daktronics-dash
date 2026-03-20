import type { ReactNode } from "react";

interface WizardShellProps {
  step: 1 | 2 | 3 | 4;
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  canBack?: boolean;
  canNext?: boolean;
  nextLabel?: string;
  backLabel?: string;
  isBusy?: boolean;
  footerExtra?: ReactNode;
}

const steps: Array<{ id: 1 | 2 | 3 | 4; label: string }> = [
  { id: 1, label: "Sport Setup" },
  { id: 2, label: "Template" },
  { id: 3, label: "Connection" },
  { id: 4, label: "Dashboard" },
];

export function WizardShell({
  step,
  children,
  onBack,
  onNext,
  canBack = true,
  canNext = true,
  nextLabel = "Next",
  backLabel = "Back",
  isBusy,
  footerExtra,
}: WizardShellProps): JSX.Element {
  return (
    <div className="wizard-shell">
      <header className="wizard-header">
        <h1>DakDash Desktop</h1>
        <p>Scoreboard setup and runtime control for OBS overlays.</p>
      </header>

      <ol className="wizard-steps" aria-label="Wizard progress">
        {steps.map((item) => {
          const isActive = item.id === step;
          const isComplete = item.id < step;
          return (
            <li
              key={item.id}
              className={`wizard-step ${isActive ? "wizard-step-active" : ""} ${isComplete ? "wizard-step-complete" : ""}`}
            >
              <span className="wizard-step-index">{item.id}</span>
              <span className="wizard-step-label">{item.label}</span>
            </li>
          );
        })}
      </ol>

      <main className="wizard-content">{children}</main>

      <footer className="wizard-footer">
        <div className="wizard-footer-actions">
          <button type="button" className="button button-ghost" onClick={onBack} disabled={!canBack || isBusy || !onBack}>
            {backLabel}
          </button>
          {onNext ? (
            <button type="button" className="button" onClick={onNext} disabled={!canNext || isBusy}>
              {isBusy ? "Working..." : nextLabel}
            </button>
          ) : null}
        </div>
        {footerExtra ? <div className="wizard-footer-extra">{footerExtra}</div> : null}
      </footer>
    </div>
  );
}
