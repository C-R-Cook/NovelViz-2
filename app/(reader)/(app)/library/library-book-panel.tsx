"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { AdminFeaturedImageToggle } from "@/components/gallery/admin-featured-image-toggle";
import { GeneratedPromptFaqLink } from "@/components/generated-prompt-faq-link";
import { PromptDetailsDisclosure } from "@/components/prompt-details-disclosure";
import { ImageGenerationLoader } from "@/components/ui/image-generation-loader";
import { ModalImageNavArrows } from "@/components/gallery/modal-image-nav-arrows";
import { ModalImageSwipeView } from "@/components/gallery/modal-image-swipe-view";
import { AiFailureNotice } from "@/components/subscription/ai-failure-notice";
import {
  QuotaExhaustedModal,
  type QuotaExhaustedPayload,
} from "@/components/subscription/quota-exhausted-modal";
import { IMAGINE_FAL_DEFAULT_ADMIN_KEY, type ImagineFalModelKey } from "@/lib/imagine-fal-models";
import { isTextEntryFocused } from "@/lib/is-text-entry-focused";

import { LibrarySectionHead } from "./library-section-head";
import type { LibraryBookRow, LibraryChapter, LibraryProgress } from "./library-types";

export type { LibraryChapter, LibraryProgress };

export type ImageHistoryItem = {
  id: string;
  userPrompt: string;
  fullPrompt: string;
  imageUrl: string;
  isPublic: boolean;
  isFeatured: boolean;
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

export type LibraryBookImagesSection = {
  title: string;
  headExtra: ReactNode;
  content: ReactNode;
};

export type LibraryBookPanelSections = {
  ai: ReactNode;
  images: LibraryBookImagesSection | null;
};

type Props = {
  book: LibraryBookRow;
  chapterNumber: number;
  viewerRole: "reader" | "partner" | "admin";
  initialTab?: "ask" | "imagine";
  initialQuestion?: string;
  children?: (sections: LibraryBookPanelSections) => ReactNode;
};

export function LibraryBookPanel({
  book,
  chapterNumber,
  viewerRole,
  initialTab,
  initialQuestion,
  children,
}: Props) {
  const router = useRouter();
  const chapters = book.chapters;
  const deepLinkConsumed = useRef(false);
  const total = chapters.length;

  const [question, setQuestion] = useState("");
  const [qaLoading, setQaLoading] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);
  const [quotaModal, setQuotaModal] = useState<QuotaExhaustedPayload | null>(null);
  const [aiFailureOpen, setAiFailureOpen] = useState(false);
  const [aiFailureMessage, setAiFailureMessage] = useState<string | undefined>();
  const [lastAnswer, setLastAnswer] = useState<string | null>(null);

  const [activeAiTab, setActiveAiTab] = useState<ReaderAiTab>("imagine");

  useEffect(() => {
    if (deepLinkConsumed.current) return;
    if (!initialTab && !initialQuestion) return;
    deepLinkConsumed.current = true;
    if (initialQuestion) {
      setQuestion(initialQuestion);
      setActiveAiTab("ask");
    } else if (initialTab === "ask") {
      setActiveAiTab("ask");
    } else if (initialTab === "imagine") {
      setActiveAiTab("imagine");
    }
    router.replace(`/library?book=${encodeURIComponent(book.bookId)}`, { scroll: false });
  }, [initialTab, initialQuestion, router, book.bookId]);

  const [imgPrompt, setImgPrompt] = useState("");
  const [adminImagineFalModel, setAdminImagineFalModel] = useState<ImagineFalModelKey>(IMAGINE_FAL_DEFAULT_ADMIN_KEY);
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);

  const [imageHistory, setImageHistory] = useState<ImageHistoryItem[]>([]);
  const [imageHistoryLoading, setImageHistoryLoading] = useState(false);
  const [imageHistoryError, setImageHistoryError] = useState<string | null>(null);
  const [imageHistoryInitialized, setImageHistoryInitialized] = useState(false);
  const [selectedHistoryImage, setSelectedHistoryImage] = useState<ImageHistoryItem | null>(null);
  const [historySwipeDir, setHistorySwipeDir] = useState<-1 | 0 | 1>(0);
  const [historySwipeBusy, setHistorySwipeBusy] = useState(false);
  const [shareUpdatingIds, setShareUpdatingIds] = useState<Record<string, boolean>>({});
  const [promptCopied, setPromptCopied] = useState<PromptCopyKind | null>(null);
  const promptCopyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        body: JSON.stringify({ bookId: book.bookId, questionText: trimmed }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        responseText?: string;
        limitType?: string;
        used?: number;
        limit?: number | null;
        resetDate?: string;
        creditBalance?: number;
        creditCost?: number;
        tier?: string;
        creditPurchasesEnabled?: boolean;
      };
      if (!res.ok) {
        if (data.error === "LIMIT_REACHED") {
          setQuotaModal(data);
          return;
        }
        if (data.error === "AI_FAILURE") {
          setAiFailureMessage(data.message);
          setAiFailureOpen(true);
          return;
        }
        setQaError(data.error || "Something went wrong");
        return;
      }
      if (typeof data.responseText === "string") {
        setLastAnswer(data.responseText);
        setQuestion("");
      } else {
        setQaError("Invalid response from server");
      }
    } catch {
      setQaError("Network error. Try again.");
    } finally {
      setQaLoading(false);
    }
  }, [book.bookId, question]);

  const loadImageHistory = useCallback(async () => {
    setImageHistoryLoading(true);
    setImageHistoryError(null);
    try {
      const res = await fetch(`/api/imagine?bookId=${encodeURIComponent(book.bookId)}`);
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        images?: ImageHistoryItem[];
      };
      if (!res.ok) {
        setImageHistoryError(data.error || "Could not load image history");
        setImageHistory([]);
        return;
      }
      setImageHistory(
        Array.isArray(data.images)
          ? data.images.map((img) => ({
              ...img,
              isFeatured: img.isFeatured ?? false,
            }))
          : [],
      );
    } catch {
      setImageHistoryError("Network error");
      setImageHistory([]);
    } finally {
      setImageHistoryLoading(false);
      setImageHistoryInitialized(true);
    }
  }, [book.bookId]);

  useEffect(() => {
    setImageHistoryInitialized(false);
  }, [book.bookId]);

  const openHistoryImageModal = useCallback((item: ImageHistoryItem) => {
    setHistorySwipeDir(0);
    setHistorySwipeBusy(false);
    setSelectedHistoryImage(item);
  }, []);

  const submitImage = useCallback(async () => {
    const trimmed = imgPrompt.trim();
    if (!trimmed) return;
    setImgLoading(true);
    setImgError(null);
    try {
      const res = await fetch("/api/imagine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: book.bookId,
          userPrompt: trimmed,
          ...(viewerRole === "admin" ? { falImagineModel: adminImagineFalModel } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        imageUrl?: string;
        fullPrompt?: string;
        image?: ImageHistoryItem;
        limitType?: string;
        used?: number;
        limit?: number | null;
        resetDate?: string;
        creditBalance?: number;
        creditCost?: number;
        tier?: string;
        creditPurchasesEnabled?: boolean;
      };
      if (!res.ok) {
        if (data.error === "LIMIT_REACHED") {
          setQuotaModal(data);
          return;
        }
        if (data.error === "AI_FAILURE") {
          setAiFailureMessage(data.message);
          setAiFailureOpen(true);
          return;
        }
        setImgError(data.error || "Something went wrong");
        return;
      }
      if (data.image && typeof data.image.id === "string") {
        const item = data.image as ImageHistoryItem;
        openHistoryImageModal(item);
        setImgPrompt("");
        setImageHistory((prev) => [item, ...prev.filter((i) => i.id !== item.id)]);
        void loadImageHistory();
      } else if (typeof data.imageUrl === "string") {
        const fullPrompt = typeof data.fullPrompt === "string" ? data.fullPrompt : "";
        openHistoryImageModal({
          id: `temp-${Date.now()}`,
          userPrompt: trimmed,
          fullPrompt,
          imageUrl: data.imageUrl,
          isPublic: false,
          isFeatured: false,
          chapterNumberAtTime: chapterNumber,
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
  }, [book.bookId, imgPrompt, loadImageHistory, chapterNumber, openHistoryImageModal, viewerRole, adminImagineFalModel]);

  const setImagePublicState = useCallback(
    async (imageId: string, isPublic: boolean) => {
      if (!imageId || imageId.startsWith("temp-") || shareUpdatingIds[imageId]) {
        return;
      }

      const previous = imageHistory.find((item) => item.id === imageId)?.isPublic;
      const previousSelected =
        selectedHistoryImage?.id === imageId ? selectedHistoryImage.isPublic : null;

      setShareUpdatingIds((prev) => ({ ...prev, [imageId]: true }));
      setImageHistory((prev) =>
        prev.map((item) => (item.id === imageId ? { ...item, isPublic } : item)),
      );
      setSelectedHistoryImage((prev) =>
        prev && prev.id === imageId ? { ...prev, isPublic } : prev,
      );

      try {
        const res = await fetch(`/api/gallery/${imageId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isPublic }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          image?: { isPublic?: boolean };
          error?: string;
        };
        if (!res.ok || typeof data.image?.isPublic !== "boolean") {
          throw new Error(data.error || "Failed to update sharing");
        }

        const resolved = data.image.isPublic;
        setImageHistory((prev) =>
          prev.map((item) => (item.id === imageId ? { ...item, isPublic: resolved } : item)),
        );
        setSelectedHistoryImage((prev) =>
          prev && prev.id === imageId ? { ...prev, isPublic: resolved } : prev,
        );
      } catch {
        if (typeof previous === "boolean") {
          setImageHistory((prev) =>
            prev.map((item) =>
              item.id === imageId ? { ...item, isPublic: previous } : item,
            ),
          );
        }
        if (typeof previousSelected === "boolean") {
          setSelectedHistoryImage((prev) =>
            prev && prev.id === imageId ? { ...prev, isPublic: previousSelected } : prev,
          );
        }
      } finally {
        setShareUpdatingIds((prev) => ({ ...prev, [imageId]: false }));
      }
    },
    [imageHistory, selectedHistoryImage, shareUpdatingIds],
  );

  const readerHistoryModalIndex = useMemo(() => {
    if (!selectedHistoryImage || imageHistory.length === 0) return -1;
    return imageHistory.findIndex((img) => img.id === selectedHistoryImage.id);
  }, [selectedHistoryImage, imageHistory]);

  const dismissHistoryImageModal = useCallback(() => {
    setSelectedHistoryImage(null);
    setHistorySwipeDir(0);
    setHistorySwipeBusy(false);
  }, []);

  const bumpHistoryImageModal = useCallback(
    (delta: number) => {
      if (!selectedHistoryImage || historySwipeBusy || imageHistory.length <= 1) return;
      const i = imageHistory.findIndex((img) => img.id === selectedHistoryImage.id);
      if (i < 0) return;
      const next = i + delta;
      if (next < 0 || next >= imageHistory.length) return;
      const item = imageHistory[next];
      if (!item) return;
      setHistorySwipeDir(delta > 0 ? 1 : -1);
      setSelectedHistoryImage(item);
    },
    [selectedHistoryImage, imageHistory, historySwipeBusy],
  );

  useEffect(() => {
    if (!selectedHistoryImage) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dismissHistoryImageModal();
        return;
      }
      if (imageHistory.length <= 1) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (isTextEntryFocused()) return;
      event.preventDefault();
      if (historySwipeBusy) return;
      const delta = event.key === "ArrowRight" ? 1 : -1;
      bumpHistoryImageModal(delta);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    selectedHistoryImage,
    imageHistory,
    historySwipeBusy,
    dismissHistoryImageModal,
    bumpHistoryImageModal,
  ]);

  useEffect(() => {
    setPromptCopied(null);
    if (promptCopyTimeoutRef.current) {
      clearTimeout(promptCopyTimeoutRef.current);
      promptCopyTimeoutRef.current = null;
    }
  }, [selectedHistoryImage?.id]);

  useEffect(() => {
    if (!imageHistoryInitialized && !imageHistoryLoading) {
      void loadImageHistory();
    }
  }, [imageHistoryInitialized, imageHistoryLoading, loadImageHistory]);

  const emptyNotice = (
    <p className="rounded-lg border border-border bg-bg-base/80 px-4 py-3 text-sm text-text-secondary">
      This book hasn&apos;t been ingested yet, check back soon
    </p>
  );

  const delistedNotice = (
    <p className="rounded-lg border border-border bg-bg-base/80 px-4 py-3 text-sm leading-relaxed text-text-secondary">
      This book has been delisted from the catalogue by its publisher or a NovelViz administrator.
      Ask a Question and Generate Image are not available for delisted titles. You can still view
      images you created earlier.
    </p>
  );

  const aiSection =
    total === 0 ? (
      emptyNotice
    ) : book.removedFromCatalogue ? (
      delistedNotice
    ) : (
      <section className="library-book-tabs library-book-tabs--split">
              <div
                className="library-book-tabs-list flex gap-1 border-b border-border"
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
                      ? "border-b-2 border-accent text-text-primary"
                      : "text-text-muted hover:text-text-primary"
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
                      ? "border-b-2 border-accent text-text-primary"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  Ask a Question
                </button>
              </div>

              {activeAiTab === "imagine" ? (
                <div className="space-y-3 pt-1" role="tabpanel">
                    {viewerRole === "admin" ? (
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-text-primary">Image model (admin)</span>
                        <select
                          value={adminImagineFalModel}
                          onChange={(e) => setAdminImagineFalModel(e.target.value as ImagineFalModelKey)}
                          disabled={imgLoading}
                          className="w-full max-w-md rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/25 disabled:opacity-60"
                        >
                          <option value="flux-schnell">flux/schnell (~$0.003 / image)</option>
                          <option value="grok">Grok Imagine (~$0.02 / image)</option>
                          <option value="seedream-v45">Seedream v4.5 (~$0.04 / image)</option>
                        </select>
                      </label>
                    ) : null}
                    <textarea
                      value={imgPrompt}
                      onChange={(e) => setImgPrompt(e.target.value)}
                      placeholder="Describe a scene, character, or moment from what you've read..."
                      rows={4}
                      disabled={imgLoading}
                      className="w-full resize-y rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-secondary focus:border-accent/50 focus:ring-2 focus:ring-accent/25 disabled:opacity-60"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void submitImage()}
                        disabled={imgLoading || !imgPrompt.trim()}
                        className="rounded-lg border border-accent/35 bg-accent-muted px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-accent-hover/90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {imgLoading ? "Generating…" : "Generate Image"}
                      </button>
                    </div>
                    {imgError ? (
                      <p className="text-sm text-error">{imgError}</p>
                    ) : null}
                    {imgLoading ? (
                      <div className="rounded-lg border border-border/80 bg-bg-base/50 py-8">
                        <ImageGenerationLoader />
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
                      className="w-full resize-y rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-secondary focus:border-accent/50 focus:ring-2 focus:ring-accent/25 disabled:opacity-60"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void submitQuestion()}
                        disabled={qaLoading || !question.trim()}
                        className="rounded-lg border border-accent/35 bg-accent-muted px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-accent-hover/90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {qaLoading ? "Asking…" : "Ask"}
                      </button>
                    </div>
                    {qaError ? (
                      <p className="text-sm text-error">{qaError}</p>
                    ) : null}
                    {lastAnswer && !qaLoading ? (
                      <div className="rounded-lg border border-border bg-bg-base/90 px-3 py-3">
                        <div className="text-sm leading-relaxed text-text-primary [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:font-serif [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:font-serif [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:font-semibold [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_strong]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-1">
                          <ReactMarkdown>{lastAnswer}</ReactMarkdown>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
      </section>
    );

  const imagesSection: LibraryBookImagesSection | null =
    total === 0 ? null : {
      title: `My ${book.title} images`,
      headExtra: (
        <Link href={`/gallery/${book.bookId}?from=library`} className="library-section-head-link">
          See all →
        </Link>
      ),
      content: (
          <section
            className="library-book-images space-y-2 rounded-xl border border-border bg-bg-surface/50 p-4"
            aria-label={`My ${book.title} images gallery`}
          >
            {imageHistoryLoading ? (
                <p className="text-xs text-text-muted">Loading…</p>
              ) : imageHistoryError ? (
                <p className="text-xs text-error">{imageHistoryError}</p>
              ) : imageHistory.length === 0 ? (
                <p className="text-xs text-text-muted">No images yet.</p>
              ) : (
                <ul className="flex gap-3 overflow-x-auto pb-1">
                  {imageHistory.map((item) => (
                    <li
                      key={item.id}
                      className="w-36 shrink-0 overflow-hidden rounded-lg border border-border/80 bg-bg-base/50 sm:w-40"
                    >
                      <button
                        type="button"
                        onClick={() => openHistoryImageModal(item)}
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
                      </button>
                      <div className="space-y-1 p-2">
                        <p className="line-clamp-2 text-xs text-text-secondary">
                          {item.userPrompt}
                        </p>
                        <p className="text-[10px] text-text-secondary">
                          Chapter {item.chapterNumberAtTime}
                        </p>
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => void setImagePublicState(item.id, !item.isPublic)}
                            disabled={!!shareUpdatingIds[item.id] || item.id.startsWith("temp-")}
                            className={`inline-flex items-center justify-center rounded-md border px-2.5 py-1 text-[10px] font-semibold transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
                              item.isPublic
                                ? "border-error/35 bg-error/10 text-error"
                                : "border-success/35 bg-success/10 text-success"
                            }`}
                          >
                            {shareUpdatingIds[item.id]
                              ? "Saving…"
                              : item.isPublic
                                ? "Make private"
                                : "Make public"}
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
          </section>
      ),
    };

  const imageModal = selectedHistoryImage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg-overlay/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Generated image details"
          onClick={() => dismissHistoryImageModal()}
        >
          <div
            className="flex h-[min(92vh,48rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-bg-surface p-3 shadow-2xl sm:p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex shrink-0 items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-[11px] text-text-muted sm:text-xs">
                  Chapter {selectedHistoryImage.chapterNumberAtTime} ·{" "}
                  {new Date(selectedHistoryImage.createdAt).toLocaleString(undefined, {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
                <span className="inline-flex rounded-full border border-border bg-bg-base px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                  Your image
                </span>
              </div>
              <button
                type="button"
                onClick={() => dismissHistoryImageModal()}
                className="rounded-md px-2 py-1 text-[11px] font-medium text-text-muted hover:bg-bg-surface sm:text-xs"
              >
                Close
              </button>
            </div>

            <div className="relative min-h-0 flex-1 overflow-hidden">
              <ModalImageSwipeView
                slide={{
                  id: selectedHistoryImage.id,
                  imageUrl: selectedHistoryImage.imageUrl,
                  userPrompt: selectedHistoryImage.userPrompt,
                  locked: false,
                }}
                direction={historySwipeDir}
                onDirectionConsumed={() => setHistorySwipeDir(0)}
                onAnimatingChange={setHistorySwipeBusy}
                sizes="(max-width: 768px) 100vw, min(896px, 100vw)"
              />
              <ModalImageNavArrows
                show={imageHistory.length > 1}
                canPrev={readerHistoryModalIndex > 0 && !historySwipeBusy}
                canNext={
                  readerHistoryModalIndex >= 0 &&
                  readerHistoryModalIndex < imageHistory.length - 1 &&
                  !historySwipeBusy
                }
                onPrev={() => bumpHistoryImageModal(-1)}
                onNext={() => bumpHistoryImageModal(1)}
              />
            </div>

            <div className="mt-3 shrink-0">
              <div className="space-y-4">
                <div className="rounded-md border border-border bg-bg-base/60 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => void setImagePublicState(selectedHistoryImage.id, !selectedHistoryImage.isPublic)}
                    disabled={
                      !!shareUpdatingIds[selectedHistoryImage.id] ||
                      selectedHistoryImage.id.startsWith("temp-")
                    }
                    className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
                      selectedHistoryImage.isPublic
                        ? "border-error/35 bg-error/10 text-error"
                        : "border-success/35 bg-success/10 text-success"
                    }`}
                  >
                    {shareUpdatingIds[selectedHistoryImage.id]
                      ? "Saving…"
                      : selectedHistoryImage.isPublic
                        ? "Make private"
                        : "Make public"}
                    <ArrowRight className="h-3 w-3" aria-hidden />
                  </button>
                  <p className="mt-1 text-xs text-text-secondary">
                    {selectedHistoryImage.isPublic
                      ? "This image is currently visible in the community gallery."
                      : "Share this image with the NovelViz community."}
                  </p>
                  <AdminFeaturedImageToggle
                    show={viewerRole === "admin"}
                    imageId={selectedHistoryImage.id}
                    isFeatured={selectedHistoryImage.isFeatured}
                    disabled={selectedHistoryImage.id.startsWith("temp-")}
                    className="mt-2"
                    onFeaturedChange={(next) => {
                      setImageHistory((rows) =>
                        rows.map((row) =>
                          row.id === selectedHistoryImage.id ? { ...row, isFeatured: next } : row,
                        ),
                      );
                      setSelectedHistoryImage((cur) =>
                        cur && cur.id === selectedHistoryImage.id ? { ...cur, isFeatured: next } : cur,
                      );
                    }}
                  />
                </div>

                <div className="rounded-md border border-border bg-bg-base/60 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      setImgPrompt(selectedHistoryImage.userPrompt);
                      setActiveAiTab("imagine");
                      dismissHistoryImageModal();
                      // TODO: reuse additional generation settings when more options are added
                    }}
                    className="rounded-md border border-border bg-bg-surface px-3 py-1.5 text-xs font-medium text-text-primary transition hover:bg-bg-raised"
                  >
                    Reuse settings
                  </button>
                </div>

                <PromptDetailsDisclosure
                  label="Original Prompt"
                  actions={
                    <button
                      type="button"
                      title="Copy original prompt"
                      aria-label="Copy original prompt"
                      className="shrink-0 rounded p-1 text-text-muted transition hover:bg-bg-raised/80 hover:text-text-primary"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void copyPromptText("original", selectedHistoryImage.userPrompt);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {promptCopied === "original" ? (
                        <CheckIcon className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <CopyIcon className="h-3.5 w-3.5" />
                      )}
                    </button>
                  }
                >
                  <p className="mt-2 text-xs text-text-primary sm:text-sm">
                    {selectedHistoryImage.userPrompt}
                  </p>
                </PromptDetailsDisclosure>
                <PromptDetailsDisclosure
                  label="Generated Prompt"
                  actions={
                    <>
                      <GeneratedPromptFaqLink />
                      <button
                        type="button"
                        title="Copy generated prompt"
                        aria-label="Copy generated prompt"
                        className="shrink-0 rounded p-1 text-text-muted transition hover:bg-bg-raised/80 hover:text-text-primary"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void copyPromptText("generated", selectedHistoryImage.fullPrompt);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        {promptCopied === "generated" ? (
                          <CheckIcon className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <CopyIcon className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </>
                  }
                >
                  <p className="mt-2 text-xs leading-relaxed text-text-secondary sm:text-sm">
                    {selectedHistoryImage.fullPrompt}
                  </p>
                </PromptDetailsDisclosure>
              </div>
            </div>
          </div>
        </div>
      ) : null;

  const subscriptionModals = (
    <>
      <QuotaExhaustedModal
        open={quotaModal !== null}
        payload={quotaModal}
        onClose={() => setQuotaModal(null)}
      />
      <AiFailureNotice
        open={aiFailureOpen}
        message={aiFailureMessage}
        onClose={() => {
          setAiFailureOpen(false);
          setAiFailureMessage(undefined);
        }}
      />
    </>
  );

  if (children) {
    return (
      <>
        {children({ ai: aiSection, images: imagesSection })}
        {imageModal}
        {subscriptionModals}
      </>
    );
  }

  return (
    <div className="library-book-panel">
      {aiSection}
      {imagesSection ? (
        <section className="library-book-images-fallback" aria-label={imagesSection.title}>
          <LibrarySectionHead title={imagesSection.title}>{imagesSection.headExtra}</LibrarySectionHead>
          {imagesSection.content}
        </section>
      ) : null}
      {imageModal}
      {subscriptionModals}
    </div>
  );
}
