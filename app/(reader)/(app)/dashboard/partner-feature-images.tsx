"use client";

import type { PartnerFeatureImageRow } from "@/lib/partner-feature-images";
import type { PartnerQueryRow } from "@/lib/partner-queries";
import { formatActivityAtUtc } from "@/lib/format-activity-at";
import type { FeatureRequestStatus } from "@db";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type OwnFeatureRequest = {
  id: string;
  status: FeatureRequestStatus;
  createdAtMs: number;
  bookTitle: string;
  chapterNumberAtTime: number;
  userPrompt: string;
  imageUrl: string;
};

type ImagesResponse = {
  images: PartnerFeatureImageRow[];
  hasMore: boolean;
  pageSize: number;
};

type QueriesResponse = {
  queries: PartnerQueryRow[];
  hasMore: boolean;
  pageSize: number;
};

function truncate(s: string, max: number) {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function ActivityTimestamp({ ms }: { ms: number }) {
  const text = useMemo(() => formatActivityAtUtc(new Date(ms)), [ms]);
  return <p className="text-[10px] text-text-muted">{text}</p>;
}

function statusClass(s: FeatureRequestStatus) {
  if (s === "PENDING") return "border-warning/50 bg-warning/15 text-warning";
  if (s === "APPROVED") return "border-success/45 bg-success/15 text-success";
  if (s === "REJECTED") return "border-error/40 bg-error/10 text-error";
  return "border-border text-text-muted";
}

function PartnerFeatureImageCard({
  image,
  busy,
  onRequest,
}: {
  image: PartnerFeatureImageRow;
  busy: boolean;
  onRequest: (imageId: string) => void;
}) {
  const pending = image.featureRequest?.status === "PENDING";
  const rejected = image.featureRequest?.status === "REJECTED";
  const featured = image.isFeatured;
  const canRequestFeature = image.isPublic && !featured && !pending;

  return (
    <li className="flex flex-col overflow-hidden rounded-lg border border-border/80 bg-bg-base/60">
      <div className="relative aspect-square w-full overflow-hidden bg-bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary storage URLs */}
        <img src={image.imageUrl} alt="" className="h-full w-full object-cover" />
        {!image.isPublic ? (
          <span className="absolute left-2 top-2 rounded-full border border-border-subtle bg-bg-overlay/70 px-2 py-0.5 font-mono text-[7px] uppercase tracking-wide text-text-muted">
            Private
          </span>
        ) : null}
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
        <p className="line-clamp-2 text-[10px] text-text-secondary">{truncate(image.userPrompt, 120)}</p>
        <div className="mt-auto flex flex-wrap justify-end gap-2 pt-1">
          {featured ? (
            <span className="rounded-md bg-accent-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent-text ring-1 ring-accent/35">
              ★ Featured
            </span>
          ) : null}
          {pending ? (
            <span className="rounded-md bg-bg-raised px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-text-muted ring-1 ring-border">
              Pending review
            </span>
          ) : null}
          {rejected ? (
            <span className="rounded-md bg-error/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-error/90 ring-1 ring-error/25">
              Request rejected
            </span>
          ) : null}
          {canRequestFeature ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onRequest(image.id)}
              className="rounded-md bg-bg-raised px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-primary ring-1 ring-border transition hover:bg-bg-surface disabled:opacity-50"
            >
              {busy ? "…" : "Request feature"}
            </button>
          ) : null}
          {rejected && image.isPublic ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onRequest(image.id)}
              className="rounded-md bg-bg-raised px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-primary ring-1 ring-border transition hover:bg-bg-surface disabled:opacity-50"
            >
              {busy ? "…" : "Re-request"}
            </button>
          ) : null}
          <Link
            href={`/partner/books/${image.bookId}`}
            className="inline-flex items-center rounded-md border border-border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-primary hover:bg-bg-surface"
          >
            Book
          </Link>
        </div>
      </div>
    </li>
  );
}

export function PartnerFeatureImages({
  ownFeatureRequests,
  initialImages,
  initialHasMore,
  pageSize,
  initialQueries,
  initialQueriesHasMore,
  queriesPageSize,
  className,
}: {
  ownFeatureRequests: OwnFeatureRequest[];
  initialImages: PartnerFeatureImageRow[];
  initialHasMore: boolean;
  pageSize: number;
  initialQueries: PartnerQueryRow[];
  initialQueriesHasMore: boolean;
  queriesPageSize: number;
  className?: string;
}) {
  const [images, setImages] = useState(initialImages);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [skip, setSkip] = useState(initialImages.length);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyImageId, setBusyImageId] = useState<string | null>(null);

  const [queries, setQueries] = useState(initialQueries);
  const [queriesHasMore, setQueriesHasMore] = useState(initialQueriesHasMore);
  const [queriesSkip, setQueriesSkip] = useState(initialQueries.length);
  const [loadingMoreQueries, setLoadingMoreQueries] = useState(false);

  useEffect(() => {
    setImages(initialImages);
    setHasMore(initialHasMore);
    setSkip(initialImages.length);
  }, [initialImages, initialHasMore]);

  useEffect(() => {
    setQueries(initialQueries);
    setQueriesHasMore(initialQueriesHasMore);
    setQueriesSkip(initialQueries.length);
  }, [initialQueries, initialQueriesHasMore]);

  const loadMoreImages = useCallback(async () => {
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        skip: String(skip),
        take: String(pageSize),
      });
      const res = await fetch(`/api/partner/images?${params.toString()}`);
      if (!res.ok) return;
      const data = (await res.json()) as ImagesResponse;
      setImages((prev) => [...prev, ...data.images]);
      setHasMore(data.hasMore);
      setSkip((s) => s + data.images.length);
    } finally {
      setLoadingMore(false);
    }
  }, [pageSize, skip]);

  const loadMoreQueries = useCallback(async () => {
    setLoadingMoreQueries(true);
    try {
      const params = new URLSearchParams({
        skip: String(queriesSkip),
        take: String(queriesPageSize),
      });
      const res = await fetch(`/api/partner/queries?${params.toString()}`);
      if (!res.ok) return;
      const data = (await res.json()) as QueriesResponse;
      setQueries((prev) => [...prev, ...data.queries]);
      setQueriesHasMore(data.hasMore);
      setQueriesSkip((s) => s + data.queries.length);
    } finally {
      setLoadingMoreQueries(false);
    }
  }, [queriesPageSize, queriesSkip]);

  const submitRequest = useCallback(async (imageId: string) => {
    setBusyImageId(imageId);
    try {
      const res = await fetch("/api/feature-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        id?: string;
        status?: FeatureRequestStatus;
      };
      if (res.status === 409) {
        window.alert(j.error ?? "A request already exists for this image.");
        return;
      }
      if (!res.ok) {
        window.alert(j.error ?? "Request failed");
        return;
      }
      if (typeof j.id === "string" && j.status) {
        setImages((prev) =>
          prev.map((row) =>
            row.id === imageId ? { ...row, featureRequest: { id: j.id!, status: j.status! } } : row,
          ),
        );
      }
    } finally {
      setBusyImageId(null);
    }
  }, []);

  return (
    <div className={className ? `${className} space-y-14` : "space-y-14"}>
      <section aria-labelledby="partner-images-heading" className="space-y-4">
        <div>
          <h2 id="partner-images-heading" className="text-lg font-semibold text-text-primary">
            Images on your books
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            All reader-generated images on your published titles. Public images can be submitted for featuring on
            Discover.
          </p>
        </div>
        {images.length === 0 ? (
          <p className="text-sm text-text-muted">No images on your books yet.</p>
        ) : (
          <>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {images.map((img) => (
                <PartnerFeatureImageCard
                  key={img.id}
                  image={img}
                  busy={busyImageId === img.id}
                  onRequest={(id) => void submitRequest(id)}
                />
              ))}
            </ul>
            {hasMore ? (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => void loadMoreImages()}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-bg-surface disabled:opacity-50"
                >
                  {loadingMore ? "Loading…" : "Load more images"}
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section aria-labelledby="partner-queries-heading" className="space-y-4">
        <div>
          <h2 id="partner-queries-heading" className="text-lg font-semibold text-text-primary">
            Questions on your books
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Q&A sessions readers have started while reading your titles.
          </p>
        </div>
        {queries.length === 0 ? (
          <p className="text-sm text-text-muted">No questions on your books yet.</p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {queries.map((q) => (
                <div
                  key={q.id}
                  className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-bg-surface/35 px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap gap-2">
                      <span className="font-mono text-[8px] uppercase tracking-widest text-accent/80">
                        {q.bookTitle}
                      </span>
                      <span className="font-mono text-[8px] text-text-muted">Ch. {q.chapterNumberAtTime}</span>
                      <span className="font-mono text-[8px] text-text-muted">@{q.username}</span>
                    </div>
                    <p className="font-serif text-sm italic leading-relaxed text-text-primary">
                      &ldquo;{truncate(q.questionText, 220)}&rdquo;
                    </p>
                    <ActivityTimestamp ms={q.createdAtMs} />
                  </div>
                  <Link
                    href={`/partner/books/${q.bookId}`}
                    className="shrink-0 self-start rounded border border-border px-2.5 py-1 font-mono text-[8px] uppercase tracking-wide text-text-secondary hover:border-accent/40"
                  >
                    Book
                  </Link>
                </div>
              ))}
            </div>
            {queriesHasMore ? (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  disabled={loadingMoreQueries}
                  onClick={() => void loadMoreQueries()}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-bg-surface disabled:opacity-50"
                >
                  {loadingMoreQueries ? "Loading…" : "Load more questions"}
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>

      {ownFeatureRequests.length > 0 ? (
        <section aria-labelledby="partner-requests-heading" className="space-y-4">
          <div>
            <h2 id="partner-requests-heading" className="text-lg font-semibold text-text-primary">
              Your feature requests
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Pending and past requests for Discover featuring ({ownFeatureRequests.length} shown).
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {ownFeatureRequests.map((fr) => (
              <div
                key={fr.id}
                className="flex items-center gap-3.5 rounded-lg border border-border-subtle bg-bg-surface/35 px-4 py-3"
              >
                <div className="relative h-12 w-[38px] shrink-0 overflow-hidden rounded border border-border-subtle">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fr.imageUrl} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 font-mono text-[8px] uppercase tracking-widest text-accent/60">
                    {fr.bookTitle} · Ch. {fr.chapterNumberAtTime}
                  </div>
                  <p className="truncate font-serif text-sm italic text-text-primary/80">
                    &ldquo;{truncate(fr.userPrompt, 120)}&rdquo;
                  </p>
                  <ActivityTimestamp ms={fr.createdAtMs} />
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-[8px] uppercase tracking-wide ${statusClass(fr.status)}`}
                >
                  {fr.status === "PENDING"
                    ? "Pending"
                    : fr.status === "APPROVED"
                      ? "Featured"
                      : fr.status === "REJECTED"
                        ? "Rejected"
                        : fr.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
