interface ErrorBannerProps {
  error: string | null;
  warnings?: string[];
  onDismissError?: () => void;
}

export function ErrorBanner({ error, warnings = [], onDismissError }: ErrorBannerProps): JSX.Element | null {
  if (!error && warnings.length === 0) {
    return null;
  }

  return (
    <section className="error-banner" role="status" aria-live="polite">
      {error ? (
        <div className="error-banner-item error-banner-error">
          <span>{error}</span>
          {onDismissError ? (
            <button type="button" className="button button-ghost" onClick={onDismissError}>
              Dismiss
            </button>
          ) : null}
        </div>
      ) : null}

      {warnings.map((warning) => (
        <div key={warning} className="error-banner-item error-banner-warning">
          <span>{warning}</span>
        </div>
      ))}
    </section>
  );
}
