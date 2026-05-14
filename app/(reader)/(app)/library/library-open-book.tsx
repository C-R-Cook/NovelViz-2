"use client";

import type { LibraryBookRow } from "./library-types";
import { formatGenre } from "@/lib/genre";
import { useEffect } from "react";

export type LibraryOpenBookProps = {
  book: LibraryBookRow;
  isOpen: boolean;
  onAnimationComplete?: () => void;
};

export function LibraryOpenBook({ book, isOpen, onAnimationComplete }: LibraryOpenBookProps) {
  const phase = isOpen ? "open" : "closed";
  const contentVisible = isOpen;

  useEffect(() => {
    if (!isOpen) return;
    queueMicrotask(() => onAnimationComplete?.());
  }, [isOpen, book.bookId, onAnimationComplete]);

  const currentChapter = book.progress?.currentChapterNumber ?? 1;
  const totalChapters = Math.max(1, book.chapterTotal);
  const progressPct = Math.round((currentChapter / totalChapters) * 100);

  const lines = Array.from({ length: 18 }, (_, i) => i);

  return (
    <div className="library-open-book-wrap">
      <div
        className="library-open-book-shadow-ellipse"
        data-visible={phase !== "closed" ? "true" : "false"}
      />
      <div
        className="library-open-book-pedestal"
        data-visible={phase !== "closed" ? "true" : "false"}
      />
      <div className="library-open-book-perspective">
        <div className="library-open-book-tilt" data-phase={phase}>
          <div className="library-open-book-page library-open-book-page--left" data-phase={phase}>
            {lines.map((i) => (
              <div
                key={`ll-${i}`}
                className="library-open-book-line"
                style={{ top: 24 + i * 14, left: 18, right: 14 }}
              />
            ))}
            <div
              className="library-open-book-content library-open-book-content--left"
              data-visible={contentVisible ? "true" : "false"}
            >
              <div>
                <div
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 8,
                    letterSpacing: "0.2em",
                    color: "rgba(120,80,40,0.5)",
                    textTransform: "uppercase",
                    marginBottom: 14,
                  }}
                >
                  Currently Reading
                </div>
                {book.genre ? (
                  <div
                    style={{
                      fontFamily: "Georgia, serif",
                      fontSize: 9,
                      color: "rgba(80,50,20,0.5)",
                      marginBottom: 6,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                    }}
                  >
                    {formatGenre(book.genre)}
                  </div>
                ) : null}
                <h2
                  style={{
                    fontFamily: "Georgia, serif",
                    fontSize: book.title.length > 22 ? 16 : book.title.length > 14 ? 18 : 22,
                    color: "#2c1a0a",
                    fontWeight: 400,
                    lineHeight: 1.2,
                    margin: "0 0 8px",
                  }}
                >
                  {book.title}
                </h2>
                <div
                  style={{
                    fontFamily: "Georgia, serif",
                    fontSize: 13,
                    color: "rgba(80,50,20,0.6)",
                    fontStyle: "italic",
                  }}
                >
                  by {book.author}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 8,
                    letterSpacing: "0.12em",
                    color: "rgba(120,80,40,0.45)",
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  Reading Progress
                </div>
                <div
                  style={{
                    height: 3,
                    background: "rgba(120,80,40,0.15)",
                    borderRadius: 2,
                    overflow: "hidden",
                    marginBottom: 5,
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${progressPct}%`,
                      background: "linear-gradient(to right, rgba(120,80,40,0.4), rgba(120,80,40,0.7))",
                      borderRadius: 2,
                      transition: "none",
                    }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span
                    style={{
                      fontFamily: "ui-monospace, monospace",
                      fontSize: 8,
                      color: "rgba(80,50,20,0.4)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    Chapter {currentChapter} of {totalChapters}
                  </span>
                  <span
                    style={{
                      fontFamily: "ui-monospace, monospace",
                      fontSize: 8,
                      color: "rgba(120,80,40,0.6)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {progressPct}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="library-open-book-spine" />

          <div className="library-open-book-page library-open-book-page--right" data-phase={phase}>
            {lines.map((i) => (
              <div
                key={`lr-${i}`}
                className="library-open-book-line"
                style={{ top: 24 + i * 14, left: 14, right: 18 }}
              />
            ))}
            <div
              className="library-open-book-content library-open-book-content--right"
              data-visible={contentVisible ? "true" : "false"}
            >
              <div
                style={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 8,
                  letterSpacing: "0.2em",
                  color: "rgba(120,80,40,0.5)",
                  textTransform: "uppercase",
                }}
              >
                Your Journey
              </div>

              {(
                [
                  { label: "Questions Asked", value: String(book.queryCount), icon: "?" },
                  { label: "Images Created", value: String(book.imageCount), icon: "◻" },
                  { label: "Last Read", value: book.lastReadLabel, icon: "◷" },
                ] as const
              ).map(({ label, value, icon }) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    paddingBottom: 10,
                    borderBottom: "1px solid rgba(120,80,40,0.1)",
                  }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 4,
                      background: "rgba(120,80,40,0.08)",
                      border: "1px solid rgba(120,80,40,0.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "ui-monospace, monospace",
                      fontSize: 10,
                      color: "rgba(120,80,40,0.5)",
                      flexShrink: 0,
                    }}
                  >
                    {icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: "ui-monospace, monospace",
                        fontSize: 7,
                        letterSpacing: "0.1em",
                        color: "rgba(80,50,20,0.4)",
                        textTransform: "uppercase",
                        marginBottom: 1,
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        fontFamily: "Georgia, serif",
                        fontSize: 13,
                        color: "#2c1a0a",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {value}
                    </div>
                  </div>
                </div>
              ))}

              <div style={{ marginTop: "auto" }}>
                <div
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 7,
                    letterSpacing: "0.1em",
                    color: "rgba(80,50,20,0.4)",
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  Chapters Remaining
                </div>
                <div style={{ fontFamily: "Georgia, serif", fontSize: 18, color: "#2c1a0a" }}>
                  {Math.max(0, totalChapters - currentChapter)}
                  <span style={{ fontSize: 11, color: "rgba(80,50,20,0.4)", marginLeft: 4 }}>
                    of {totalChapters}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
