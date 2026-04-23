"use client";

import Image from "next/image";
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

type PromptCopyKind = "original" | "generated";

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

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
  const [historyInitialized, setHistoryInitialized] = useState(false);

  const [activeAiTab, setActiveAiTab] = useState<ReaderAiTab>("imagine");

  const [imgPrompt, setImgPrompt] = useState("");
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);

  const [imageHistory, setImageHistory] = useState<ImageHistoryItem[]>([]);
  const [imageHistoryLoading, setImageHistoryLoading] = useState(false);
  const [imageHistoryError, setImageHistoryError] = useState<string | null>(null);
  const [imageHistoryInitialized, setImageHistoryInitialized] = useState(false);
  const [selectedHistoryImage, setSelectedHistoryImage] = useState<ImageHistoryItem | null>(null);
  const [promptCopied, setPromptCopied] = useState<PromptCopyKind | null>(null);
  const promptCopyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedChapter = chapters.find((c) => c.id === selectedChapterId);

  const copyPromptText = useCallback(async (kind: PromptCopyKind, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (promptCopyTimeoutRef.current) {
        clearTimeout(promptCopyTimeoutRef.current);
      }
      setPromptCopied(kind);
      promptCopyTimeoutRef.current = setTimeout(() => {
        setPromptCopied(null);
        promptCopyTimeoutRef.current = null;
      }, 2000);
    } catch {
      setPromptCopied(null);
    }
  }, []);

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
      setHistoryInitialized(true);
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
        void loadQueryHistory();
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
      setImageHistoryInitialized(true);
    }
  }, [book.id]);

  useEffect(() => {
    setHistoryInitialized(false);
    setImageHistoryInitialized(false);
  }, [book.id]);

  const submitImage = useCallback(async () => {
    const trimmed = imgPrompt.trim();
    if (!trimmed) return;
    setImgLoading(true);
    setImgError(null);
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
        image?: ImageHistoryItem;
      };
      if (!res.ok) {
        setImgError(data.error || "Something went wrong");
        return;
      }
      if (data.image && typeof data.image.id === "string") {
        const item = data.image as ImageHistoryItem;
        setSelectedHistoryImage(item);
        setImgPrompt("");
        setImageHistory((prev) => [item, ...prev.filter((i) => i.id !== item.id)]);
        void loadImageHistory();
      } else if (typeof data.imageUrl === "string") {
        const fullPrompt = typeof data.fullPrompt === "string" ? data.fullPrompt : "";
        setSelectedHistoryImage({
          id: `temp-${Date.now()}`,
          userPrompt: trimmed,
          fullPrompt,
          imageUrl: data.imageUrl,
          chapterNumberAtTime: savedProgress?.currentChapterNumber ?? 1,
          createdAt: new Date().toISOString(),
        });
        setImgPrompt("");
        void loadImageHistory();
      } else {
        setImgError("Invalid response from server");
      }
    } catch {
      setImgError("Network error. Try again.");
    } finally {
      setImgLoading(false);
    }
  }, [book.id, imgPrompt, loadImageHistory, savedProgress?.currentChapterNumber]);

  useEffect(() => {
    if (!selectedHistoryImage) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedHistoryImage(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedHistoryImage]);

  useEffect(() => {
    setPromptCopied(null);
    if (promptCopyTimeoutRef.current) {
      clearTimeout(promptCopyTimeoutRef.current);
      promptCopyTimeoutRef.current = null;
    }
  }, [selectedHistoryImage?.id]);

  useEffect(() => {
    if (activeAiTab === "imagine") {
      if (!imageHistoryInitialized && !imageHistoryLoading) {
        void loadImageHistory();
      }
      return;
    }

    if (!historyInitialized && !historyLoading) {
      void loadQueryHistory();
    }
  }, [
    activeAiTab,
    historyInitialized,
    historyLoading,
    imageHistoryInitialized,
    imageHistoryLoading,
    loadImageHistory,
    loadQueryHistory,
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
      <header className="space-y-3 sm:space-y-4">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 sm:gap-x-3">
          <h1 className="font-serif text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-2xl">
            {book.title}
          </h1>
          <span className="hidden text-zinc-300 sm:inline dark:text-zinc-600" aria-hidden>
            ·
          </span>
          <p className="min-w-0 text-sm text-zinc-600 dark:text-zinc-400">{book.author}</p>
        </div>

      </header>

      {total === 0 ? (
        <p className="mt-6 rounded-lg border border-zinc-200/90 bg-zinc-50/80 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
          This book hasn&apos;t been ingested yet, check back soon
        </p>
      ) : (
        <>
          <section className="mt-4 grid gap-4 lg:grid-cols-4">
            <div className="overflow-hidden rounded-xl border border-zinc-200/90 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-1">
              <div className="relative aspect-[2/3] w-full">
                {book.coverImageUrl ? (
                  <Image
                    src={book.coverImageUrl}
                    alt={`Cover: ${book.title}`}
                    fill
                    className="object-cover"
                    sizes="(min-width: 1024px) 22vw, (min-width: 640px) 40vw, 75vw"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-4 text-center text-sm leading-tight text-zinc-500 dark:text-zinc-600">
                    No cover available
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-zinc-200/90 bg-white/60 p-4 dark:border-zinc-800/80 dark:bg-zinc-900/30 sm:p-5 lg:col-span-3">
              <h2 className="font-serif text-lg font-semibold text-zinc-900 dark:text-amber-100/90">
                Ask &amp; imagine
              </h2>
              <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-500">
                We use only information and descriptions up to your current chapter to avoid spoilers.
              </p>

              <section className="rounded-lg border border-zinc-200/80 bg-zinc-50/70 px-3 py-3 dark:border-zinc-800/70 dark:bg-zinc-900/20 sm:px-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="min-w-0 sm:min-w-72">
                    <span className="sr-only">Current chapter</span>
                    <select
                      value={selectedChapterId}
                      onChange={(e) => setSelectedChapterId(e.target.value)}
                      className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 outline-none focus:border-amber-600/50 focus:ring-2 focus:ring-amber-400/25 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100"
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
                    className="shrink-0 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    {saving ? "Saving…" : "Save chapter"}
                  </button>
                </div>
                {message ? (
                  <p
                    className={
                      message.type === "ok"
                        ? "mt-2 text-xs text-emerald-700 dark:text-emerald-400/90"
                        : "mt-2 text-xs text-red-600 dark:text-red-400"
                    }
                  >
                    {message.text}
                  </p>
                ) : null}
              </section>

              <div
                className="flex gap-1 border-b border-zinc-200/90 dark:border-zinc-800/80"
                role="tablist"
                aria-label="Reader AI tools"
              >
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
              </div>

              {activeAiTab === "imagine" ? (
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
                  </div>
                ) : (
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
                  </div>
                )}
            </div>
          </section>

          <section className="mt-4 space-y-2 rounded-xl border border-zinc-200/90 bg-white/50 p-4 dark:border-zinc-800/80 dark:bg-zinc-900/20">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
              {activeAiTab === "imagine" ? "Previous image generations" : "Previous questions"}
            </p>
            {activeAiTab === "imagine" ? (
              imageHistoryLoading ? (
                <p className="text-xs text-zinc-500">Loading…</p>
              ) : imageHistoryError ? (
                <p className="text-xs text-red-600 dark:text-red-400/90">{imageHistoryError}</p>
              ) : imageHistory.length === 0 ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-500">No images yet.</p>
              ) : (
                <ul className="flex gap-3 overflow-x-auto pb-1">
                  {imageHistory.map((item) => (
                    <li
                      key={item.id}
                      className="w-36 shrink-0 overflow-hidden rounded-lg border border-zinc-200/80 bg-zinc-50/50 dark:border-zinc-800/70 dark:bg-zinc-950/30 sm:w-40"
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedHistoryImage(item)}
                        className="w-full text-left"
                        aria-label={`Open generated image for prompt: ${item.userPrompt}`}
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
                          <p className="line-clamp-2 text-xs text-zinc-700 dark:text-zinc-300">
                            {item.userPrompt}
                          </p>
                          <p className="text-[10px] text-zinc-400 dark:text-zinc-600">
                            Chapter {item.chapterNumberAtTime}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : historyLoading ? (
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
          </section>

        </>
      )}

      {selectedHistoryImage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Generated image details"
          onClick={() => setSelectedHistoryImage(null)}
        >
          <div
            className="flex h-[min(92vh,48rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-zinc-200/90 bg-white p-3 shadow-2xl dark:border-zinc-800/80 dark:bg-zinc-900 sm:p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex shrink-0 items-center justify-between">
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 sm:text-xs">
                Chapter {selectedHistoryImage.chapterNumberAtTime} ·{" "}
                {new Date(selectedHistoryImage.createdAt).toLocaleString(undefined, {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </p>
              <button
                type="button"
                onClick={() => setSelectedHistoryImage(null)}
                className="rounded-md px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 sm:text-xs"
              >
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1">
              <Image
                src={selectedHistoryImage.imageUrl}
                alt={selectedHistoryImage.userPrompt}
                width={1200}
                height={900}
                unoptimized
                className="h-full w-full rounded-lg border border-zinc-200/90 object-contain dark:border-zinc-800/80"
              />
            </div>

            <div className="mt-3 shrink-0">
              <div className="space-y-4">
                <details className="rounded-md border border-zinc-200/90 bg-zinc-50/60 px-3 py-2 dark:border-zinc-800/80 dark:bg-zinc-950/30">
                  <summary className="flex cursor-pointer list-none items-center gap-2 marker:content-none [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 sm:text-[11px]">
                      Original Prompt
                    </span>
                    <button
                      type="button"
                      title="Copy original prompt"
                      aria-label="Copy original prompt"
                      className="shrink-0 rounded p-1 text-zinc-500 transition hover:bg-zinc-200/80 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700/80 dark:hover:text-zinc-100"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void copyPromptText("original", selectedHistoryImage.userPrompt);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {promptCopied === "original" ? (
                        <CheckIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <CopyIcon className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </summary>
                  <p className="mt-2 text-xs text-zinc-800 dark:text-zinc-200 sm:text-sm">
                    {selectedHistoryImage.userPrompt}
                  </p>
                </details>
                <details className="rounded-md border border-zinc-200/90 bg-zinc-50/60 px-3 py-2 dark:border-zinc-800/80 dark:bg-zinc-950/30">
                  <summary className="flex cursor-pointer list-none items-center gap-2 marker:content-none [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 sm:text-[11px]">
                      Generated Prompt
                    </span>
                    <button
                      type="button"
                      title="Copy generated prompt"
                      aria-label="Copy generated prompt"
                      className="shrink-0 rounded p-1 text-zinc-500 transition hover:bg-zinc-200/80 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700/80 dark:hover:text-zinc-100"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void copyPromptText("generated", selectedHistoryImage.fullPrompt);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {promptCopied === "generated" ? (
                        <CheckIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <CopyIcon className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </summary>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300 sm:text-sm">
                    {selectedHistoryImage.fullPrompt}
                  </p>
                </details>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
