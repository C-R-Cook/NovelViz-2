"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { useCallback, useEffect, useRef, useState } from "react";

export type ReaderBook = {
  id: string;
  title: string;
  author: string;
  coverImageUrl: string | null;
};

export type ReaderChapter = {
  id: string;
  sequenceNumber: number;
  title: string | null;
};

export type ReaderProgress = {
  currentChapterId: string;
  currentChapterNumber: number;
};

export type QueryHistoryItem = {
  id: string;
  questionText: string;
  responseText: string;
  chapterNumberAtTime: number;
  createdAt: string;
};

export type ImageHistoryItem = {
  id: string;
  userPrompt: string;
  fullPrompt: string;
  imageUrl: string;
  chapterNumberAtTime: number;
  createdAt: string;
};

type ReaderAiTab = "ask" | "imagine";

type Props = {
  book: ReaderBook;
  chapters: ReaderChapter[];
  initialProgress: ReaderProgress | null;
};

export function ReaderClient({ book, chapters, initialProgress }: Props) {
  const router = useRouter();
  const total = chapters.length;

  const [selectedChapterId, setSelectedChapterId] = useState<string>(() => {
    if (initialProgress) return initialProgress.currentChapterId;
    if (chapters[0]) return chapters[0].id;
    return "";
  });

  const [savedProgress, setSavedProgress] = useState<ReaderProgress | null>(initialProgress);

  useEffect(() => {
    setSavedProgress(initialProgress);
    if (initialProgress) {
      setSelectedChapterId(initialProgress.currentChapterId);
    } else if (chapters[0]) {
      setSelectedChapterId(chapters[0].id);
    }
  }, [initialProgress, chapters]);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [question, setQuestion] = useState("");
  const [qaLoading, setQaLoading] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);
  const [lastAnswer, setLastAnswer] = useState<string | null>(null);

  const [historyQueries, setHistoryQueries] = useState<QueryHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const historyDetailsRef = useRef<HTMLDetailsElement>(null);

  const [activeAiTab, setActiveAiTab] = useState<ReaderAiTab>("ask");

  const [imgPrompt, setImgPrompt] = useState("");
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);
  const [lastImageUrl, setLastImageUrl] = useState<string | null>(null);
  const [lastFullPrompt, setLastFullPrompt] = useState<string | null>(null);

  const [imageHistory, setImageHistory] = useState<ImageHistoryItem[]>([]);
  const [imageHistoryLoading, setImageHistoryLoading] = useState(false);
  const [imageHistoryError, setImageHistoryError] = useState<string | null>(null);
  const imageDetailsRef = useRef<HTMLDetailsElement>(null);

  const selectedChapter = chapters.find((c) => c.id === selectedChapterId);

  const saveProgress = useCallback(async () => {
    if (!selectedChapterId || !selectedChapter) {
      setMessage({ type: "err", text: "Select a chapter first." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/progress/${book.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapterId: selectedChapterId,
          chapterNumber: selectedChapter.sequenceNumber,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        progress?: ReaderProgress;
      };
      if (!res.ok) {
        setMessage({ type: "err", text: data.error || "Could not save progress" });
        return;
      }
      if (data.progress) {
        setSavedProgress({
          currentChapterId: data.progress.currentChapterId,
          currentChapterNumber: data.progress.currentChapterNumber,
        });
      }
      setMessage({ type: "ok", text: "Progress saved." });
      router.refresh();
    } catch {
      setMessage({ type: "err", text: "Network error. Try again." });
    } finally {
      setSaving(false);
    }
  }, [book.id, selectedChapter, selectedChapterId, router]);

  const loadQueryHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch(`/api/query?bookId=${encodeURIComponent(book.id)}`);
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        queries?: QueryHistoryItem[];
      };
      if (!res.ok) {
        setHistoryError(data.error || "Could not load history");
        setHistoryQueries([]);
        return;
      }
      setHistoryQueries(Array.isArray(data.queries) ? data.queries : []);
    } catch {
      setHistoryError("Network error");
      setHistoryQueries([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [book.id]);

  const submitQuestion = useCallback(async () => {
    const trimmed = question.trim();
    if (!trimmed) return;
    setQaLoading(true);
    setQaError(null);
    setLastAnswer(null);
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: book.id, questionText: trimmed }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        responseText?: string;
      };
      if (!res.ok) {
        setQaError(data.error || "Something went wrong");
        return;
      }
      if (typeof data.responseText === "string") {
        setLastAnswer(data.responseText);
        setQuestion("");
        if (historyDetailsRef.current?.open) {
          void loadQueryHistory();
        }
      } else {
        setQaError("Invalid response from server");
      }
    } catch {
      setQaError("Network error. Try again.");
    } finally {
      setQaLoading(false);
    }
  }, [book.id, question, loadQueryHistory]);

  const loadImageHistory = useCallback(async () => {
    setImageHistoryLoading(true);
    setImageHistoryError(null);
    try {
      const res = await fetch(`/api/imagine?bookId=${encodeURIComponent(book.id)}`);
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        images?: ImageHistoryItem[];
      };
      if (!res.ok) {
        setImageHistoryError(data.error || "Could not load image history");
        setImageHistory([]);
        return;
      }
      setImageHistory(Array.isArray(data.images) ? data.images : []);
    } catch {
      setImageHistoryError("Network error");
      setImageHistory([]);
    } finally {
      setImageHistoryLoading(false);
    }
  }, [book.id]);

  const submitImage = useCallback(async () => {
    const trimmed = imgPrompt.trim();
    if (!trimmed) return;
    setImgLoading(true);
    setImgError(null);
    setLastImageUrl(null);
    setLastFullPrompt(null);
    try {
      const res = await fetch("/api/imagine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: book.id, userPrompt: trimmed }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        imageUrl?: string;
        fullPrompt?: string;
      };
      if (!res.ok) {
        setImgError(data.error || "Something went wrong");
        return;
      }
      if (typeof data.imageUrl === "string") {
        setLastImageUrl(data.imageUrl);
        setLastFullPrompt(typeof data.fullPrompt === "string" ? data.fullPrompt : null);
        setImgPrompt("");
        if (imageDetailsRef.current?.open) {
          void loadImageHistory();
        }
      } else {
        setImgError("Invalid response from server");
      }
    } catch {
      setImgError("Network error. Try again.");
    } finally {
      setImgLoading(false);
    }
  }, [book.id, imgPrompt, loadImageHistory]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link
        href="/library"
        className="inline-flex text-sm font-medium text-zinc-600 transition hover:text-amber-800 dark:text-zinc-500 dark:hover:text-amber-200/90"
      >
        ← Back to library
      </Link>

      <div className="mt-8 flex flex-col gap-10 lg:flex-row lg:items-start">
        <div className="relative mx-auto w-full max-w-[280px] shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 shadow-xl shadow-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/30 lg:mx-0">
          <div className="relative aspect-[2/3] w-full">
            {book.coverImageUrl ? (
              <Image
                src={book.coverImageUrl}
                alt={book.title}
                fill
                className="object-cover"
                priority
                sizes="280px"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-zinc-500 dark:text-zinc-600">
                No cover
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-6">
          <div>
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
              {book.title}
            </h1>
            <p className="mt-2 text-lg text-zinc-600 dark:text-zinc-400">{book.author}</p>
          </div>

          {total === 0 ? (
            <p className="rounded-lg border border-zinc-200/90 bg-zinc-50/80 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
              This book hasn&apos;t been ingested yet, check back soon
            </p>
          ) : (
            <>
              <section className="space-y-4 rounded-xl border border-zinc-200/90 bg-white/60 p-4 dark:border-zinc-800/80 dark:bg-zinc-900/30 sm:p-5">
                <h2 className="font-serif text-lg font-semibold text-zinc-900 dark:text-amber-100/90">
                  Your Progress
                </h2>

                {savedProgress && total > 0 ? (
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">
                    You are reading Chapter {savedProgress.currentChapterNumber} of {total}
                  </p>
                ) : (
                  <p className="text-sm text-zinc-600 dark:text-zinc-500">
                    Set your current chapter below, then save.
                  </p>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="min-w-0 flex-1 space-y-1.5">
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-500">
                      Current chapter
                    </span>
                    <select
                      value={selectedChapterId}
                      onChange={(e) => setSelectedChapterId(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-amber-600/50 focus:ring-2 focus:ring-amber-400/25 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100"
                    >
                      {chapters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.sequenceNumber}. {c.title?.trim() || "Untitled"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={saveProgress}
                    disabled={saving || !selectedChapterId}
                    className="shrink-0 rounded-lg border border-amber-700/50 bg-amber-100/90 px-4 py-2 text-sm font-medium text-amber-950 transition hover:bg-amber-200/90 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100/95 dark:hover:bg-amber-950/50"
                  >
                    {saving ? "Saving…" : "Save Progress"}
                  </button>
                </div>

                {message ? (
                  <p
                    className={
                      message.type === "ok"
                        ? "text-sm text-emerald-700 dark:text-emerald-400/90"
                        : "text-sm text-red-600 dark:text-red-400"
                    }
                  >
                    {message.text}
                  </p>
                ) : null}
              </section>

              <section className="space-y-3 rounded-xl border border-zinc-200/90 bg-white/60 p-4 dark:border-zinc-800/80 dark:bg-zinc-900/30 sm:p-5">
                <h2 className="font-serif text-lg font-semibold text-zinc-900 dark:text-amber-100/90">
                  Ask &amp; imagine
                </h2>
                <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-500">
                  Both tools only use what you&apos;ve read up to your saved chapter. Save progress above
                  first.
                </p>

                <div
                  className="flex gap-1 border-b border-zinc-200/90 dark:border-zinc-800/80"
                  role="tablist"
                  aria-label="Reader AI tools"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeAiTab === "ask"}
                    onClick={() => setActiveAiTab("ask")}
                    className={`rounded-t-md px-3 py-2 text-sm font-medium transition ${
                      activeAiTab === "ask"
                        ? "border-b-2 border-amber-600 text-zinc-900 dark:border-amber-400 dark:text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300"
                    }`}
                  >
                    Ask a Question
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeAiTab === "imagine"}
                    onClick={() => setActiveAiTab("imagine")}
                    className={`rounded-t-md px-3 py-2 text-sm font-medium transition ${
                      activeAiTab === "imagine"
                        ? "border-b-2 border-amber-600 text-zinc-900 dark:border-amber-400 dark:text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300"
                    }`}
                  >
                    Generate Image
                  </button>
                </div>

                {activeAiTab === "ask" ? (
                  <div className="space-y-3 pt-1" role="tabpanel">
                    <textarea
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="Ask a question about what you've read so far..."
                      rows={4}
                      disabled={qaLoading}
                      className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-amber-600/50 focus:ring-2 focus:ring-amber-400/25 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100 dark:placeholder:text-zinc-600"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void submitQuestion()}
                        disabled={qaLoading || !question.trim()}
                        className="rounded-lg border border-amber-700/50 bg-amber-100/90 px-4 py-2 text-sm font-medium text-amber-950 transition hover:bg-amber-200/90 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100/95 dark:hover:bg-amber-950/50"
                      >
                        {qaLoading ? "Asking…" : "Ask"}
                      </button>
                    </div>
                    {qaError ? (
                      <p className="text-sm text-red-600 dark:text-red-400">{qaError}</p>
                    ) : null}
                    {lastAnswer && !qaLoading ? (
                      <div className="rounded-lg border border-zinc-200/90 bg-zinc-50/90 px-3 py-3 dark:border-zinc-700/90 dark:bg-zinc-950/40">
                        <div className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-100 [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:font-serif [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:font-serif [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:font-semibold [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_strong]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-1">
                          <ReactMarkdown>{lastAnswer}</ReactMarkdown>
                        </div>
                      </div>
                    ) : null}

                    <details
                      ref={historyDetailsRef}
                      className="group border-t border-zinc-200/80 pt-3 dark:border-zinc-800/70"
                      onToggle={(e) => {
                        if ((e.target as HTMLDetailsElement).open) {
                          void loadQueryHistory();
                        }
                      }}
                    >
                      <summary className="cursor-pointer list-none text-xs font-medium text-zinc-500 marker:content-none dark:text-zinc-500 [&::-webkit-details-marker]:hidden">
                        <span className="underline decoration-zinc-300 decoration-dotted underline-offset-2 group-open:text-zinc-600 dark:decoration-zinc-600 dark:group-open:text-zinc-400">
                          Previous questions
                        </span>
                      </summary>
                      <div className="mt-3 space-y-1">
                        {historyLoading ? (
                          <p className="text-xs text-zinc-500">Loading…</p>
                        ) : historyError ? (
                          <p className="text-xs text-red-600 dark:text-red-400/90">{historyError}</p>
                        ) : historyQueries.length === 0 ? (
                          <p className="text-xs text-zinc-500 dark:text-zinc-500">No questions yet.</p>
                        ) : (
                          <ul className="max-h-80 space-y-0 divide-y divide-zinc-200/80 overflow-y-auto dark:divide-zinc-800/80">
                            {historyQueries.map((q) => (
                              <li key={q.id} className="py-3 first:pt-0">
                                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                                  {q.questionText}
                                </p>
                                <p className="mt-1.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                                  {q.responseText}
                                </p>
                                <p className="mt-2 text-[11px] text-zinc-400 dark:text-zinc-600">
                                  Chapter {q.chapterNumberAtTime} ·{" "}
                                  {new Date(q.createdAt).toLocaleString(undefined, {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  })}
                                </p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </details>
                  </div>
                ) : (
                  <div className="space-y-3 pt-1" role="tabpanel">
                    <textarea
                      value={imgPrompt}
                      onChange={(e) => setImgPrompt(e.target.value)}
                      placeholder="Describe a scene, character, or moment from what you've read..."
                      rows={4}
                      disabled={imgLoading}
                      className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-amber-600/50 focus:ring-2 focus:ring-amber-400/25 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100 dark:placeholder:text-zinc-600"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void submitImage()}
                        disabled={imgLoading || !imgPrompt.trim()}
                        className="rounded-lg border border-amber-700/50 bg-amber-100/90 px-4 py-2 text-sm font-medium text-amber-950 transition hover:bg-amber-200/90 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100/95 dark:hover:bg-amber-950/50"
                      >
                        {imgLoading ? "Generating…" : "Generate Image"}
                      </button>
                    </div>
                    {imgError ? (
                      <p className="text-sm text-red-600 dark:text-red-400">{imgError}</p>
                    ) : null}
                    {imgLoading ? (
                      <div className="flex flex-col items-center gap-3 rounded-lg border border-zinc-200/80 bg-zinc-50/50 py-8 dark:border-zinc-800/70 dark:bg-zinc-950/30">
                        <div
                          className="h-9 w-9 animate-spin rounded-full border-2 border-zinc-300 border-t-amber-600 dark:border-zinc-700 dark:border-t-amber-400"
                          aria-hidden
                        />
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                          Generating your image...
                        </p>
                      </div>
                    ) : null}
                    {lastImageUrl && !imgLoading ? (
                      <div className="space-y-2">
                        <Image
                          src={lastImageUrl}
                          alt="Generated from your prompt"
                          width={1024}
                          height={768}
                          unoptimized
                          className="h-auto w-full rounded-lg border border-zinc-200/90 object-cover dark:border-zinc-800/80"
                        />
                        {lastFullPrompt ? (
                          <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-500">
                            {lastFullPrompt}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    <details
                      ref={imageDetailsRef}
                      className="group border-t border-zinc-200/80 pt-3 dark:border-zinc-800/70"
                      onToggle={(e) => {
                        if ((e.target as HTMLDetailsElement).open) {
                          void loadImageHistory();
                        }
                      }}
                    >
                      <summary className="cursor-pointer list-none text-xs font-medium text-zinc-500 marker:content-none dark:text-zinc-500 [&::-webkit-details-marker]:hidden">
                        <span className="underline decoration-zinc-300 decoration-dotted underline-offset-2 group-open:text-zinc-600 dark:decoration-zinc-600 dark:group-open:text-zinc-400">
                          Previous Images
                        </span>
                      </summary>
                      <div className="mt-3 space-y-1">
                        {imageHistoryLoading ? (
                          <p className="text-xs text-zinc-500">Loading…</p>
                        ) : imageHistoryError ? (
                          <p className="text-xs text-red-600 dark:text-red-400/90">{imageHistoryError}</p>
                        ) : imageHistory.length === 0 ? (
                          <p className="text-xs text-zinc-500 dark:text-zinc-500">No images yet.</p>
                        ) : (
                          <ul className="grid max-h-[32rem] grid-cols-1 gap-4 overflow-y-auto sm:grid-cols-2">
                            {imageHistory.map((item) => (
                              <li
                                key={item.id}
                                className="overflow-hidden rounded-lg border border-zinc-200/80 bg-zinc-50/50 dark:border-zinc-800/70 dark:bg-zinc-950/30"
                              >
                                <Image
                                  src={item.imageUrl}
                                  alt={item.userPrompt}
                                  width={800}
                                  height={600}
                                  unoptimized
                                  className="aspect-[4/3] w-full object-cover"
                                />
                                <div className="space-y-1 p-2">
                                  <p className="text-xs text-zinc-700 dark:text-zinc-300">{item.userPrompt}</p>
                                  <p className="text-[10px] text-zinc-400 dark:text-zinc-600">
                                    Chapter {item.chapterNumberAtTime}
                                  </p>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </details>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
