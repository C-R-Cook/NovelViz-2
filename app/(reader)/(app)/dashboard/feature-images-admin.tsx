"use client";

import {
  FeatureRequestsQueue,
  type FeatureRequestQueueItem,
} from "@/app/(reader)/(app)/dashboard/feature-requests-queue";
import type { AdminFeatureImageRow } from "@/lib/admin-feature-images";
import type { AdminBookRow } from "@/lib/admin-books-list";
import { formatActivityAtUtc } from "@/lib/format-activity-at";
import type { FeatureRequestStatus } from "@db";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ImagesResponse = {
  images: AdminFeatureImageRow[];
  hasMore: boolean;
  pageSize: number;
};

type BooksResponse = {
  books: AdminBookRow[];
  hasMore: boolean;
};

function truncate(s: string, max: number) {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function ImageTimestamp({ ms }: { ms: number }) {
  const text = useMemo(() => formatActivityAtUtc(new Date(ms)), [ms]);
  return <p className="text-[10px] text-text-muted">{text}</p>;
}

function FeatureStatusBadges({
  isFeatured,
  isPublic,
  featureRequest,
}: {
  isFeatured: boolean;
  isPublic: boolean;
  featureRequest: { id: string; status: FeatureRequestStatus } | null;
}) {
  const pending = featureRequest?.status === "PENDING";
  const approved = featureRequest?.status === "APPROVED";
  const rejected = featureRequest?.status === "REJECTED";

  return (
    <div className="flex flex-wrap gap-1.5">
      {isFeatured ? (
        <span className="rounded-md bg-accent-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-text ring-1 ring-accent/35">
          ★ Featured
        </span>
      ) : null}
      {!isPublic ? (
        <span className="rounded-md bg-bg-raised px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-muted ring-1 ring-border">
          Private
        </span>
      ) : null}
      {pending ? (
        <span className="rounded-md bg-bg-raised px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-muted ring-1 ring-border">
          Request pending
        </span>
      ) : null}
      {approved ? (
        <span className="rounded-md bg-success/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-primary ring-1 ring-success/35">
          Approved
        </span>
      ) : null}
      {rejected ? (
        <span className="rounded-md bg-error/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-error/90 ring-1 ring-error/25">
          Request rejected
        </span>
      ) : null}
    </div>
  );
}

function AdminFeatureImageCard({
  image,
  busy,
  onToggleFeatured,
  onToggleVisibility,
}: {
  image: AdminFeatureImageRow;
  busy: boolean;
  onToggleFeatured: (imageId: string, nextFeatured: boolean) => void;
  onToggleVisibility?: (imageId: string, nextPublic: boolean) => void;
}) {
  return (
    <li className="flex flex-col overflow-hidden rounded-lg border border-border/80 bg-bg-base/60">
      <div className="relative aspect-square w-full overflow-hidden bg-bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary storage URLs */}
        <img src={image.imageUrl} alt="" className="h-full w-full object-cover" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start gap-2">
          <div className="relative h-12 w-8 shrink-0 overflow-hidden rounded border border-border bg-bg-surface">
            {image.bookCoverImageUrl ? (
              <Image src={image.bookCoverImageUrl} alt="" fill className="object-cover" sizes="32px" />
            ) : (
              <div className="flex h-full items-center justify-center text-[8px] text-text-muted">—</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-text-primary">{image.bookTitle}</p>
            <p className="truncate text-[10px] text-text-secondary">{image.bookAuthor}</p>
          </div>
        </div>
        <p className="text-[10px] text-text-muted">
          @{image.username} · Ch. {image.chapterNumberAtTime}
        </p>
        {image.formerUsername ? (
          <p className="text-[10px] text-text-muted">
            Was @{image.formerUsername}
          </p>
        ) : null}
        <p className="line-clamp-2 text-[10px] text-text-secondary">{truncate(image.userPrompt, 120)}</p>
        <FeatureStatusBadges
          isFeatured={image.isFeatured}
          isPublic={image.isPublic}
          featureRequest={image.featureRequest}
        />
        <ImageTimestamp ms={image.createdAtMs} />
        <div className="mt-auto flex flex-wrap justify-end gap-2 pt-1">
          {onToggleVisibility ? (
            image.isPublic ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onToggleVisibility(image.id, false)}
                className="rounded-md border border-border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-primary transition hover:bg-bg-surface disabled:opacity-50"
              >
                {busy ? "…" : "Make private"}
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => onToggleVisibility(image.id, true)}
                className="rounded-md bg-accent-muted px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-accent-text ring-1 ring-accent/35 transition hover:bg-accent/30 disabled:opacity-50"
              >
                {busy ? "…" : "Make public"}
              </button>
            )
          ) : null}
          {image.isFeatured ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onToggleFeatured(image.id, false)}
              className="rounded-md border border-border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-primary transition hover:bg-bg-surface disabled:opacity-50"
            >
              {busy ? "…" : "Remove featured"}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => onToggleFeatured(image.id, true)}
              className="rounded-md bg-accent-muted px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-accent-text ring-1 ring-accent/35 transition hover:bg-accent/30 disabled:opacity-50"
            >
              {busy ? "…" : "Feature"}
            </button>
          )}
          <Link
            href={`/admin/books/${image.bookId}`}
            className="inline-flex items-center rounded-md border border-border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-primary hover:bg-bg-surface"
          >
            Book
          </Link>
        </div>
      </div>
    </li>
  );
}

function ImageGridSection({
  title,
  description,
  images,
  loading,
  hasMore,
  loadingMore,
  onLoadMore,
  busyImageId,
  onToggleFeatured,
  onToggleVisibility,
  emptyMessage,
  sectionId,
  showHeader = true,
}: {
  title: string;
  description: string;
  images: AdminFeatureImageRow[];
  loading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore?: () => void;
  busyImageId: string | null;
  onToggleFeatured: (imageId: string, nextFeatured: boolean) => void;
  onToggleVisibility?: (imageId: string, nextPublic: boolean) => void;
  emptyMessage: string;
  sectionId: string;
  showHeader?: boolean;
}) {
  return (
    <section aria-labelledby={showHeader ? sectionId : undefined} className="space-y-4">
      {showHeader ? (
        <div>
          <h2 id={sectionId} className="text-lg font-semibold text-text-primary">
            {title}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">{description}</p>
        </div>
      ) : null}
      {loading ? (
        <div className="flex min-h-[8rem] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
        </div>
      ) : images.length === 0 ? (
        <p className="text-sm text-text-muted">{emptyMessage}</p>
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {images.map((img) => (
              <AdminFeatureImageCard
                key={img.id}
                image={img}
                busy={busyImageId === img.id}
                onToggleFeatured={onToggleFeatured}
                onToggleVisibility={onToggleVisibility}
              />
            ))}
          </ul>
          {hasMore && onLoadMore ? (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                disabled={loadingMore}
                onClick={onLoadMore}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-bg-surface disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

export function FeatureImagesAdmin({
  featureRequests,
  initialFeatured,
  initialFeaturedHasMore,
  pageSize,
  actionRequestId,
  onDecision,
  onPendingRequestResolved,
  className,
}: {
  featureRequests: FeatureRequestQueueItem[];
  initialFeatured: AdminFeatureImageRow[];
  initialFeaturedHasMore: boolean;
  pageSize: number;
  actionRequestId: string | null;
  onDecision: (requestId: string, action: "approve" | "reject") => void;
  onPendingRequestResolved?: (imageId: string) => void;
  className?: string;
}) {
  const [featuredImages, setFeaturedImages] = useState(initialFeatured);
  const [featuredHasMore, setFeaturedHasMore] = useState(initialFeaturedHasMore);
  const [featuredSkip, setFeaturedSkip] = useState(initialFeatured.length);
  const [loadingMoreFeatured, setLoadingMoreFeatured] = useState(false);

  const [allImages, setAllImages] = useState<AdminFeatureImageRow[]>([]);
  const [allHasMore, setAllHasMore] = useState(false);
  const [allSkip, setAllSkip] = useState(0);
  const [allLoading, setAllLoading] = useState(true);
  const [loadingMoreAll, setLoadingMoreAll] = useState(false);

  const [deidentifiedImages, setDeidentifiedImages] = useState<AdminFeatureImageRow[]>([]);
  const [deidentifiedHasMore, setDeidentifiedHasMore] = useState(false);
  const [deidentifiedSkip, setDeidentifiedSkip] = useState(0);
  const [deidentifiedLoading, setDeidentifiedLoading] = useState(true);
  const [loadingMoreDeidentified, setLoadingMoreDeidentified] = useState(false);

  const [bookQuery, setBookQuery] = useState("");
  const [bookResults, setBookResults] = useState<AdminBookRow[]>([]);
  const [bookSearchLoading, setBookSearchLoading] = useState(false);
  const [selectedBook, setSelectedBook] = useState<AdminBookRow | null>(null);
  const [bookImages, setBookImages] = useState<AdminFeatureImageRow[]>([]);
  const [bookImagesHasMore, setBookImagesHasMore] = useState(false);
  const [bookImagesSkip, setBookImagesSkip] = useState(0);
  const [bookImagesLoading, setBookImagesLoading] = useState(false);
  const [loadingMoreBookImages, setLoadingMoreBookImages] = useState(false);

  const [busyImageId, setBusyImageId] = useState<string | null>(null);
  const bookSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setFeaturedImages(initialFeatured);
    setFeaturedHasMore(initialFeaturedHasMore);
    setFeaturedSkip(initialFeatured.length);
  }, [initialFeatured, initialFeaturedHasMore]);

  const fetchImages = useCallback(
    async (filter: "featured" | "all" | "book" | "deidentified", skip: number, bookId?: string) => {
      const params = new URLSearchParams({
        filter,
        skip: String(skip),
        take: String(pageSize),
      });
      if (bookId) params.set("bookId", bookId);
      const res = await fetch(`/api/admin/images?${params.toString()}`);
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(j.error ?? "Could not load images");
      }
      return (await res.json()) as ImagesResponse;
    },
    [pageSize],
  );

  const loadAllImages = useCallback(
    async (reset: boolean) => {
      if (reset) {
        setAllLoading(true);
        setAllSkip(0);
      } else {
        setLoadingMoreAll(true);
      }
      try {
        const skip = reset ? 0 : allSkip;
        const data = await fetchImages("all", skip);
        setAllImages((prev) => (reset ? data.images : [...prev, ...data.images]));
        setAllHasMore(data.hasMore);
        setAllSkip(skip + data.images.length);
      } finally {
        setAllLoading(false);
        setLoadingMoreAll(false);
      }
    },
    [allSkip, fetchImages],
  );

  const loadDeidentifiedImages = useCallback(
    async (reset: boolean) => {
      if (reset) {
        setDeidentifiedLoading(true);
        setDeidentifiedSkip(0);
      } else {
        setLoadingMoreDeidentified(true);
      }
      try {
        const skip = reset ? 0 : deidentifiedSkip;
        const data = await fetchImages("deidentified", skip);
        setDeidentifiedImages((prev) => (reset ? data.images : [...prev, ...data.images]));
        setDeidentifiedHasMore(data.hasMore);
        setDeidentifiedSkip(skip + data.images.length);
      } finally {
        setDeidentifiedLoading(false);
        setLoadingMoreDeidentified(false);
      }
    },
    [deidentifiedSkip, fetchImages],
  );

  const loadBookImages = useCallback(
    async (bookId: string, reset: boolean) => {
      if (reset) {
        setBookImagesLoading(true);
        setBookImagesSkip(0);
      } else {
        setLoadingMoreBookImages(true);
      }
      try {
        const skip = reset ? 0 : bookImagesSkip;
        const data = await fetchImages("book", skip, bookId);
        setBookImages((prev) => (reset ? data.images : [...prev, ...data.images]));
        setBookImagesHasMore(data.hasMore);
        setBookImagesSkip(skip + data.images.length);
      } finally {
        setBookImagesLoading(false);
        setLoadingMoreBookImages(false);
      }
    },
    [bookImagesSkip, fetchImages],
  );

  useEffect(() => {
    void loadAllImages(true);
    void loadDeidentifiedImages(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load once
  }, []);

  useEffect(() => {
    if (bookSearchTimer.current) clearTimeout(bookSearchTimer.current);
    const q = bookQuery.trim();
    if (q.length < 2) {
      setBookResults([]);
      setBookSearchLoading(false);
      return;
    }
    setBookSearchLoading(true);
    bookSearchTimer.current = setTimeout(() => {
      void (async () => {
        try {
          const params = new URLSearchParams({
            filter: "all",
            q,
            skip: "0",
            take: "12",
            sort: "title",
            dir: "asc",
          });
          const res = await fetch(`/api/admin/books?${params.toString()}`);
          if (!res.ok) return;
          const data = (await res.json()) as BooksResponse;
          setBookResults(data.books);
        } finally {
          setBookSearchLoading(false);
        }
      })();
    }, 300);
    return () => {
      if (bookSearchTimer.current) clearTimeout(bookSearchTimer.current);
    };
  }, [bookQuery]);

  const onToggleFeatured = useCallback(
    async (imageId: string, nextFeatured: boolean) => {
      const snapFeatured = featuredImages.find((r) => r.id === imageId);
      const snapAll = allImages.find((r) => r.id === imageId);
      const snapBook = bookImages.find((r) => r.id === imageId);
      const snap = snapAll ?? snapBook ?? snapFeatured;
      const nextFeatureRequest = nextFeatured
        ? snap?.featureRequest?.status === "PENDING"
          ? { ...snap.featureRequest, status: "APPROVED" as const }
          : snap?.featureRequest ?? null
        : null;

      setBusyImageId(imageId);

      if (nextFeatured) {
        setAllImages((rows) => rows.filter((r) => r.id !== imageId));
        setBookImages((rows) => rows.filter((r) => r.id !== imageId));
        const source = snapAll ?? snapBook ?? snapFeatured;
        if (source) {
          setFeaturedImages((rows) => [
            { ...source, isFeatured: true, featureRequest: nextFeatureRequest },
            ...rows.filter((r) => r.id !== imageId),
          ]);
        }
      } else {
        setFeaturedImages((rows) => rows.filter((r) => r.id !== imageId));
        const restored = snapFeatured ?? snap;
        if (restored) {
          const row = { ...restored, isFeatured: false, featureRequest: null };
          setAllImages((rows) => [row, ...rows.filter((r) => r.id !== imageId)]);
          if (selectedBook && row.bookId === selectedBook.id) {
            setBookImages((rows) => [row, ...rows.filter((r) => r.id !== imageId)]);
          }
        }
      }

      try {
        const res = await fetch(`/api/admin/images/${imageId}/feature`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isFeatured: nextFeatured }),
        });
        if (!res.ok) {
          const j = (await res.json()) as { error?: string };
          window.alert(j.error ?? "Update failed");
          setFeaturedImages((rows) => {
            if (snapFeatured) return rows.map((r) => (r.id === imageId ? snapFeatured : r));
            if (nextFeatured) return rows.filter((r) => r.id !== imageId);
            return snapFeatured ? [snapFeatured, ...rows] : rows;
          });
          if (snapAll) {
            setAllImages((rows) =>
              rows.some((r) => r.id === imageId) ? rows : [snapAll, ...rows],
            );
          }
          if (snapBook) {
            setBookImages((rows) =>
              rows.some((r) => r.id === imageId) ? rows : [snapBook, ...rows],
            );
          }
          return;
        }
        const data = (await res.json()) as {
          id: string;
          isFeatured: boolean;
          featureRequest: AdminFeatureImageRow["featureRequest"];
        };
        if (data.isFeatured) {
          setAllImages((rows) => rows.filter((r) => r.id !== imageId));
          setBookImages((rows) => rows.filter((r) => r.id !== imageId));
          const source = snapAll ?? snapBook ?? snapFeatured;
          if (source) {
            setFeaturedImages((rows) => [
              { ...source, isFeatured: true, featureRequest: data.featureRequest },
              ...rows.filter((r) => r.id !== imageId),
            ]);
          }
          if (data.featureRequest?.status === "APPROVED") {
            onPendingRequestResolved?.(imageId);
          }
        } else {
          setFeaturedImages((rows) => rows.filter((r) => r.id !== imageId));
          const source = snapFeatured ?? snap;
          if (source) {
            const row = { ...source, isFeatured: false, featureRequest: data.featureRequest };
            setAllImages((rows) => [row, ...rows.filter((r) => r.id !== imageId)]);
            if (selectedBook && row.bookId === selectedBook.id) {
              setBookImages((rows) => [row, ...rows.filter((r) => r.id !== imageId)]);
            }
          }
          onPendingRequestResolved?.(imageId);
        }
      } finally {
        setBusyImageId(null);
      }
    },
    [
      allImages,
      bookImages,
      featuredImages,
      onPendingRequestResolved,
      selectedBook,
    ],
  );

  const onToggleVisibility = useCallback(async (imageId: string, nextPublic: boolean) => {
    setBusyImageId(imageId);
    const snap = deidentifiedImages.find((r) => r.id === imageId);
    setDeidentifiedImages((rows) =>
      rows.map((r) => (r.id === imageId ? { ...r, isPublic: nextPublic } : r)),
    );
    try {
      const res = await fetch(`/api/admin/images/${imageId}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: nextPublic }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        window.alert(j.error ?? "Update failed");
        if (snap) {
          setDeidentifiedImages((rows) =>
            rows.map((r) => (r.id === imageId ? snap : r)),
          );
        }
        return;
      }
      const data = (await res.json()) as { image: { id: string; isPublic: boolean } };
      setDeidentifiedImages((rows) =>
        rows.map((r) =>
          r.id === imageId ? { ...r, isPublic: data.image.isPublic } : r,
        ),
      );
    } finally {
      setBusyImageId(null);
    }
  }, [deidentifiedImages]);

  const loadMoreFeatured = useCallback(async () => {
    setLoadingMoreFeatured(true);
    try {
      const data = await fetchImages("featured", featuredSkip);
      setFeaturedImages((prev) => [...prev, ...data.images]);
      setFeaturedHasMore(data.hasMore);
      setFeaturedSkip((s) => s + data.images.length);
    } finally {
      setLoadingMoreFeatured(false);
    }
  }, [featuredSkip, fetchImages]);

  const selectBook = useCallback(
    (book: AdminBookRow) => {
      setSelectedBook(book);
      setBookQuery(book.title);
      setBookResults([]);
      void loadBookImages(book.id, true);
    },
    [loadBookImages],
  );

  const clearBookSelection = useCallback(() => {
    setSelectedBook(null);
    setBookQuery("");
    setBookResults([]);
    setBookImages([]);
    setBookImagesHasMore(false);
    setBookImagesSkip(0);
  }, []);

  return (
    <div className={className ? `${className} space-y-14` : "space-y-14"}>
      <ImageGridSection
        sectionId="featured-images-heading"
        title="Currently featured"
        description={`Images on the Discover community strip (${featuredImages.length} shown${featuredHasMore ? "+" : ""}).`}
        images={featuredImages}
        loading={false}
        hasMore={featuredHasMore}
        loadingMore={loadingMoreFeatured}
        onLoadMore={() => void loadMoreFeatured()}
        busyImageId={busyImageId}
        onToggleFeatured={(id, next) => void onToggleFeatured(id, next)}
        emptyMessage="No featured images yet."
      />

      <ImageGridSection
        sectionId="deidentified-images-heading"
        title="De-identified"
        description="Images retained after account deletion, owned by @NovelViz. Make public to show them in the gallery again."
        images={deidentifiedImages}
        loading={deidentifiedLoading}
        hasMore={deidentifiedHasMore}
        loadingMore={loadingMoreDeidentified}
        onLoadMore={() => void loadDeidentifiedImages(false)}
        busyImageId={busyImageId}
        onToggleFeatured={(id, next) => void onToggleFeatured(id, next)}
        onToggleVisibility={(id, next) => void onToggleVisibility(id, next)}
        emptyMessage="No de-identified images yet."
      />

      <ImageGridSection
        sectionId="all-images-heading"
        title="All images"
        description="Public images not yet on the Discover strip, newest first. Feature any image directly — no partner request required."
        images={allImages}
        loading={allLoading}
        hasMore={allHasMore}
        loadingMore={loadingMoreAll}
        onLoadMore={() => void loadAllImages(false)}
        busyImageId={busyImageId}
        onToggleFeatured={(id, next) => void onToggleFeatured(id, next)}
        emptyMessage="No images found."
      />

      <FeatureRequestsQueue
        items={featureRequests}
        actionRequestId={actionRequestId}
        onDecision={onDecision}
      />

      <section aria-labelledby="book-search-heading" className="space-y-4">
        <div>
          <h2 id="book-search-heading" className="text-lg font-semibold text-text-primary">
            Search by book
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Find a title and review or feature its images.
          </p>
        </div>
        <div className="relative max-w-xl">
          <input
            type="search"
            value={bookQuery}
            onChange={(e) => {
              setBookQuery(e.target.value);
              if (selectedBook && e.target.value !== selectedBook.title) {
                setSelectedBook(null);
                setBookImages([]);
              }
            }}
            placeholder="Search by book title or author…"
            className="w-full rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/25"
            aria-label="Search books"
          />
          {bookSearchLoading ? (
            <p className="mt-2 text-xs text-text-muted">Searching…</p>
          ) : null}
          {bookResults.length > 0 && !selectedBook ? (
            <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-bg-raised shadow-lg">
              {bookResults.map((book) => (
                <li key={book.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-bg-surface"
                    onClick={() => selectBook(book)}
                  >
                    <div className="relative h-10 w-7 shrink-0 overflow-hidden rounded border border-border bg-bg-surface">
                      {book.coverImageUrl ? (
                        <Image src={book.coverImageUrl} alt="" fill className="object-cover" sizes="28px" />
                      ) : null}
                    </div>
                    <span>
                      <span className="font-medium text-text-primary">{book.title}</span>
                      <span className="text-text-muted"> · {book.author}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {selectedBook ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-text-secondary">
              Showing images for{" "}
              <span className="font-medium text-text-primary">{selectedBook.title}</span>
            </p>
            <button
              type="button"
              onClick={clearBookSelection}
              className="text-xs font-medium text-accent-text underline-offset-2 hover:underline"
            >
              Clear
            </button>
            <Link
              href={`/admin/books/${selectedBook.id}`}
              className="text-xs font-medium text-text-primary underline-offset-2 hover:underline"
            >
              Open book admin
            </Link>
          </div>
        ) : null}
        {selectedBook ? (
          <ImageGridSection
            sectionId="book-images-grid"
            title=""
            description=""
            showHeader={false}
            images={bookImages}
            loading={bookImagesLoading}
            hasMore={bookImagesHasMore}
            loadingMore={loadingMoreBookImages}
            onLoadMore={() => void loadBookImages(selectedBook.id, false)}
            busyImageId={busyImageId}
            onToggleFeatured={(id, next) => void onToggleFeatured(id, next)}
            emptyMessage="No images for this book."
          />
        ) : (
          <p className="text-sm text-text-muted">Search for a book to browse its images.</p>
        )}
      </section>
    </div>
  );
}
