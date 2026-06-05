"use client";

import { AI_FAILURE_MESSAGE } from "@/lib/ai-failure-constants";

type Props = {
  open: boolean;
  message?: string;
  onClose: () => void;
};

export function AiFailureNotice({ open, message, onClose }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-bg-overlay/70 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="ai-failure-title"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-bg-surface p-6 shadow-xl">
        <h2 id="ai-failure-title" className="text-lg font-semibold text-text-primary">
          Something went wrong
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-text-secondary">
          {message ?? AI_FAILURE_MESSAGE}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-bg-base"
        >
          OK
        </button>
      </div>
    </div>
  );
}
