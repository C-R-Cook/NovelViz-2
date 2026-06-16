import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  label: string;
  children: ReactNode;
  /** Copy button, FAQ link, etc. — rendered before the chevron. */
  actions?: ReactNode;
};

export function PromptDetailsDisclosure({ label, children, actions }: Props) {
  return (
    <details className="group rounded-md border border-border bg-bg-base/60 px-3 py-2">
      <summary className="flex cursor-pointer list-none items-center gap-2 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted sm:text-[11px]">
          {label}
        </span>
        {actions}
        <ChevronDown
          className="h-3.5 w-3.5 shrink-0 text-text-muted transition-transform duration-200 group-open:rotate-180"
          aria-hidden
        />
      </summary>
      {children}
    </details>
  );
}
