"use client";

import { useEffect, useRef } from "react";

/** Fixed site header (~min-h-14 + padding) — keep anchored FAQ rows below the nav. */
const FAQ_ANCHOR_SCROLL_MARGIN_PX = 72;

type Props = {
  id?: string;
  q: string;
  a: string;
  detailsClass: string;
  summaryClass: string;
  chevronClass: string;
  answerClass: string;
};

function scrollToAnchor(el: HTMLElement) {
  const top = el.getBoundingClientRect().top + window.scrollY - FAQ_ANCHOR_SCROLL_MARGIN_PX;
  window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
}

export function FaqAccordionItem({ id, q, a, detailsClass, summaryClass, chevronClass, answerClass }: Props) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (!id) return;

    function activateFromHash() {
      const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
      if (hash !== id) return;

      const el = detailsRef.current;
      if (!el) return;

      el.open = true;

      // Expand first, then scroll — native hash jump runs before hydration and ignores `open`.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToAnchor(el);
        });
      });
    }

    activateFromHash();
    window.addEventListener("hashchange", activateFromHash);
    return () => window.removeEventListener("hashchange", activateFromHash);
  }, [id]);

  const anchorClass = id ? `${detailsClass} scroll-mt-[4.5rem]` : detailsClass;

  return (
    <details ref={detailsRef} id={id} className={anchorClass}>
      <summary className={summaryClass}>
        <span className="min-w-0 flex-1">{q}</span>
        <span className={chevronClass} aria-hidden>
          ▼
        </span>
      </summary>
      <div className={answerClass}>{a}</div>
    </details>
  );
}
