"use client";

import { useEffect, useState } from "react";
import type { CoverAiModelEntry } from "@/lib/cover-ai-settings";

type CoverAiSettingsModel = {
  id: string;
  basePromptPrefix: string;
  titlePromptTemplate: string;
  authorPromptTemplate: string;
  modelsJson: CoverAiModelEntry[];
};

export function CoverAiSettingsClient({ initial }: { initial: CoverAiSettingsModel }) {
  const [state, setState] = useState<CoverAiSettingsModel>(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setState(initial);
  }, [initial]);

  const [modelsText, setModelsText] = useState(() =>
    JSON.stringify(initial.modelsJson, null, 2),
  );
  useEffect(() => {
    setModelsText(JSON.stringify(initial.modelsJson, null, 2));
  }, [initial.modelsJson]);

  async function onSave() {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      let parsedModels: unknown = null;
      try {
        parsedModels = JSON.parse(modelsText);
      } catch (e) {
        throw new Error("modelsJson must be valid JSON");
      }

      const res = await fetch("/api/admin/cover-ai-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          basePromptPrefix: state.basePromptPrefix,
          titlePromptTemplate: state.titlePromptTemplate,
          authorPromptTemplate: state.authorPromptTemplate,
          modelsJson: parsedModels,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; modelsJson?: unknown };
      if (!res.ok) {
        throw new Error(data.error || res.statusText);
      }
      setState((prev) => ({
        ...prev,
        ...(data as unknown as CoverAiSettingsModel),
      }));
      setMsg("Saved.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="block">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Base prompt prefix
          </p>
          <textarea
            rows={4}
            value={state.basePromptPrefix}
            onChange={(e) => setState((s) => ({ ...s, basePromptPrefix: e.target.value }))}
            className="mt-1 w-full resize-y rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/25"
          />
        </label>
        <p className="text-xs text-text-secondary">
          The publisher prompt is appended after any optional title/author blocks.
        </p>
      </div>

      <div className="space-y-2">
        <label className="block">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Title prompt template (must include {"{{title}}"})
          </p>
          <textarea
            rows={3}
            value={state.titlePromptTemplate}
            onChange={(e) => setState((s) => ({ ...s, titlePromptTemplate: e.target.value }))}
            className="mt-1 w-full resize-y rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/25"
          />
        </label>
      </div>

      <div className="space-y-2">
        <label className="block">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Author prompt template (must include {"{{author}}"})
          </p>
          <textarea
            rows={3}
            value={state.authorPromptTemplate}
            onChange={(e) => setState((s) => ({ ...s, authorPromptTemplate: e.target.value }))}
            className="mt-1 w-full resize-y rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/25"
          />
        </label>
      </div>

      <div className="space-y-2">
        <label className="block">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Allowed models</p>
          <textarea
            rows={10}
            value={modelsText}
            onChange={(e) => setModelsText(e.target.value)}
            className="mt-1 font-mono text-[12px] w-full resize-y rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/25"
          />
        </label>
        <p className="text-xs text-text-secondary">
          JSON array of objects: <span className="font-mono">{"{ key, label, falEndpoint, inputProfile }"}</span>.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={saving}
          className="rounded-lg bg-accent-muted px-4 py-2 text-sm font-medium text-text-primary ring-1 ring-accent/40 transition hover:bg-accent-hover/90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        {msg ? <p className="text-sm text-success">{msg}</p> : null}
        {err ? <p className="text-sm text-error">{err}</p> : null}
      </div>
    </div>
  );
}

