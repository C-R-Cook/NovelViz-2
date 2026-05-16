"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { LibraryBookRow } from "./library-types";

function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

export function LibraryParticles() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );

  useEffect(() => {
    if (reducedMotion) return;
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const resize = () => {
      c.width = c.offsetWidth;
      c.height = c.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    const pts = Array.from({ length: 40 }, () => ({
      x: Math.random() * (c.width || 800),
      y: Math.random() * (c.height || 400),
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2,
      r: Math.random() * 1.1 + 0.3,
      a: Math.random() * 0.3 + 0.08,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      for (const p of pts) {
        p.x = (p.x + p.vx + c.width) % c.width;
        p.y = (p.y + p.vy + c.height) % c.height;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180,140,100,${p.a})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [reducedMotion]);

  return (
    <canvas
      ref={ref}
      className="library-particles-canvas"
      aria-hidden
      style={reducedMotion ? { display: "none" } : undefined}
    />
  );
}

type ContextProps = {
  book: LibraryBookRow;
  visible: boolean;
};

export function LibraryContextPanel({ book, visible }: ContextProps) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const currentChapter = book.progress?.currentChapterNumber ?? 1;
  /** Use saved reading progress, not Q&A/image counts — readers can be deep in a book without either. */
  const neverRead = book.progress == null;

  const ask = () => {
    const trimmed = question.trim();
    if (!trimmed) return;
    const q = encodeURIComponent(trimmed);
    router.push(`/reader/${book.bookId}?tab=ask&q=${q}`);
  };

  return (
    <div className="library-context-panel" data-visible={visible ? "true" : "false"}>
      <div className="library-card library-card--particles">
        <LibraryParticles />
        <div className="library-card-z">
          <div className="library-card-eyebrow">{neverRead ? "Begin your journey" : "Continue reading"}</div>
          <p className="library-card-title">
            {neverRead
              ? `Start Chapter 1 of ${book.title}`
              : `Pick up from Chapter ${currentChapter}`}
          </p>
          <p className="library-card-muted">
            {neverRead ? "Your AI companion is ready" : `Last read ${book.lastReadLabel}`}
          </p>
          <Link href={`/reader/${book.bookId}`} className="library-card-cta">
            Open Reader →
          </Link>
        </div>
      </div>

      <div className="library-card">
        <div className="library-card-eyebrow">Ask about Chapter {currentChapter}</div>
        {book.lastQuestion ? (
          <div className="library-last-q">
            <div className="library-last-q-label">Last question</div>
            <div className="library-last-q-text">&ldquo;{book.lastQuestion}&rdquo;</div>
          </div>
        ) : null}
        <div className="library-qa-input-row">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") ask();
            }}
            placeholder={`Ask something about ${book.title}...`}
            className="library-qa-input"
            aria-label="Question for this book"
          />
          <button type="button" className="library-qa-submit" disabled={!question.trim()} onClick={ask}>
            →
          </button>
        </div>
      </div>

      {book.imageCount === 0 ? (
        <div className="library-card">
          <div className="library-image-row">
            <div>
              <div className="library-card-eyebrow" style={{ marginBottom: 4 }}>
                No images yet
              </div>
              <p className="library-card-title" style={{ fontSize: 13, fontStyle: "italic", margin: 0 }}>
                Bring Chapter {currentChapter} to life
              </p>
            </div>
            <Link href={`/reader/${book.bookId}?tab=imagine`} className="library-card-cta" style={{ flexShrink: 0 }}>
              Generate →
            </Link>
          </div>
        </div>
      ) : (
        <div className="library-card">
          <div className="library-image-row">
            <div className="library-image-stat">
              <span style={{ fontSize: 18, opacity: 0.55 }} aria-hidden>
                ◻
              </span>
              <div>
                <div className="library-card-eyebrow" style={{ marginBottom: 2 }}>
                  {book.imageCount} image{book.imageCount === 1 ? "" : "s"} created
                </div>
                <p className="library-card-title" style={{ fontSize: 12, fontStyle: "italic", margin: 0, opacity: 0.85 }}>
                  from this book
                </p>
              </div>
            </div>
            <Link
              href={`/gallery/${book.bookId}?from=library`}
              className="library-card-cta"
              style={{
                flexShrink: 0,
                background: "transparent",
                color: "color-mix(in srgb, var(--accent) 75%, var(--text-primary))",
                border: "1px solid color-mix(in srgb, var(--accent) 28%, var(--border-subtle))",
              }}
            >
              View →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
