import Link from "next/link";
import { HelpCircle } from "lucide-react";

export const GENERATED_PROMPT_FAQ_HREF = "/faq#generated-prompt";

type Props = {
  className?: string;
};

/** Info link to the generated-prompt FAQ entry (opens in a new tab). */
export function GeneratedPromptFaqLink({ className }: Props) {
  return (
    <Link
      href={GENERATED_PROMPT_FAQ_HREF}
      target="_blank"
      rel="noopener noreferrer"
      className={
        className ??
        "shrink-0 rounded p-1 text-text-muted transition hover:bg-bg-raised/80 hover:text-text-primary"
      }
      title="What is the generated prompt?"
      aria-label="What is the generated prompt? Opens FAQ in a new tab"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <HelpCircle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
    </Link>
  );
}
