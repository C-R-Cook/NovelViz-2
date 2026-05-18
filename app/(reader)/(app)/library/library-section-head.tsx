"use client";

import type { ReactNode } from "react";

type Props = {
  title: string;
  children?: ReactNode;
  onTitleClick?: () => void;
};

export function LibrarySectionHead({ title, children, onTitleClick }: Props) {
  return (
    <div className="library-section-head">
      {onTitleClick ? (
        <button
          type="button"
          className="library-section-title library-section-title--jump"
          onClick={onTitleClick}
          title={`Back to ${title}`}
        >
          {title}
        </button>
      ) : (
        <h2 className="library-section-title" title={title}>
          {title}
        </h2>
      )}
      <div className="library-section-line" aria-hidden />
      {children}
    </div>
  );
}
