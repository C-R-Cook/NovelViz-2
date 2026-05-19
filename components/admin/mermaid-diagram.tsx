"use client";

import { useEffect, useId, useRef, useState } from "react";

type MermaidDiagramProps = {
  chart: string;
  className?: string;
};

export function MermaidDiagram({ chart, className }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderId = useId().replace(/:/g, "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const el = containerRef.current;
    if (!el) return;

    setError(null);
    el.innerHTML = "";

    void (async () => {
      try {
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          securityLevel: "strict",
          flowchart: { htmlLabels: true, curve: "basis" },
          themeVariables: {
            primaryColor: "#2a241c",
            primaryTextColor: "#e8e0d8",
            primaryBorderColor: "#8B4513",
            lineColor: "#6b5d4f",
            secondaryColor: "#1a1f24",
            tertiaryColor: "#121a14",
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
          },
        });
        const { svg } = await mermaid.render(`mmd-${renderId}`, chart);
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = svg;
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to render diagram");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chart, renderId]);

  if (error) {
    return (
      <pre className="overflow-x-auto rounded-lg border border-error/40 bg-bg-surface p-4 text-xs text-error">
        {error}
      </pre>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`mermaid-diagram overflow-x-auto rounded-lg border border-border bg-bg-surface/80 p-4 [&_svg]:mx-auto [&_svg]:max-w-full ${className ?? ""}`}
      aria-label="Flow diagram"
    />
  );
}
