"use client";

import { ChevronDown } from "lucide-react";

type Props = {
  prompt: string;
};

export function GalleryImagePromptDisclosure({ prompt }: Props) {
  const text = prompt.trim();
  if (!text) return null;

  return (
    <details className="group rounded-lg border border-border/90 bg-bg-base/60">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium text-text-muted [&::-webkit-details-marker]:hidden">
        <span>Prompt</span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-text-muted transition-transform duration-200 group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="border-t border-border/60 px-3 pb-3 pt-2">
        <p className="whitespace-pre-wrap text-sm text-text-primary">{text}</p>
      </div>
    </details>
  );
}
