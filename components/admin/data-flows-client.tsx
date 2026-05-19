"use client";

import { MermaidDiagram } from "@/components/admin/mermaid-diagram";
import {
  DATA_FLOW_SECTIONS,
  type DataFlowSectionId,
} from "@/lib/admin-data-flows";
import Link from "next/link";
import { useState } from "react";

const TAB_ORDER: DataFlowSectionId[] = ["books", "images", "questions"];

export function DataFlowsClient() {
  const [active, setActive] = useState<DataFlowSectionId>("books");
  const section = DATA_FLOW_SECTIONS.find((s) => s.id === active)!;

  return (
    <div className="space-y-6">
      <nav
        className="flex flex-wrap gap-2 border-b border-border pb-3"
        aria-label="Data flow sections"
      >
        {TAB_ORDER.map((id) => {
          const meta = DATA_FLOW_SECTIONS.find((s) => s.id === id)!;
          const selected = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActive(id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                selected
                  ? "bg-[var(--accent)]/15 text-text-primary ring-1 ring-[var(--accent)]/40"
                  : "text-text-secondary hover:bg-bg-raised hover:text-text-primary"
              }`}
            >
              {meta.title}
            </button>
          );
        })}
      </nav>

      <section className="space-y-4">
        <p className="text-sm leading-relaxed text-text-secondary">{section.summary}</p>

        <MermaidDiagram chart={section.mermaid} />

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="font-mono text-xs font-medium uppercase tracking-wider text-text-muted">
              Notes
            </h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-text-secondary">
              {section.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-mono text-xs font-medium uppercase tracking-wider text-text-muted">
              Key files
            </h3>
            <ul className="mt-2 space-y-1 text-sm">
              {section.keyFiles.map((f) => (
                <li key={f.path}>
                  <span className="text-text-secondary">{f.label}: </span>
                  <code className="text-xs text-text-primary">{f.path}</code>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {section.id === "books" ? (
          <p className="text-sm text-text-secondary">
            Related admin pages:{" "}
            <Link href="/admin/gutenberg-import" className="text-accent-text underline-offset-2 hover:underline">
              Gutenberg import
            </Link>
            {" · "}
            <Link href="/admin/books" className="text-accent-text underline-offset-2 hover:underline">
              All books
            </Link>
          </p>
        ) : null}
      </section>
    </div>
  );
}
