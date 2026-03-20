interface SvgPreviewProps {
  svg: string;
  loading?: boolean;
  error?: string | null;
  emptyLabel?: string;
}

export function SvgPreview({ svg, loading, error, emptyLabel }: SvgPreviewProps): JSX.Element {
  if (loading) {
    return <div className="svg-preview-empty">Rendering preview...</div>;
  }

  if (error) {
    return <div className="svg-preview-empty svg-preview-error">{error}</div>;
  }

  if (!svg.trim()) {
    return <div className="svg-preview-empty">{emptyLabel || "No preview available yet."}</div>;
  }

  return (
    <div
      className="svg-preview"
      dangerouslySetInnerHTML={{ __html: svg }}
      aria-label="Template preview"
    />
  );
}
