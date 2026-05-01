import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BookGenre, BookStatus, ListingPreferenceAfterReview } from "@db";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };
const ALL_STATUSES: BookStatus[] = [
  "draft",
  "pending_review",
  "rejected",
  "published",
  "unlisted",
  "processing",
];

const ALLOWED_TRANSITIONS: Record<BookStatus, BookStatus[]> = {
  draft: ["pending_review"],
  pending_review: ["draft"],
  rejected: ["draft"],
  published: ["unlisted"],
  unlisted: ["published"],
  processing: [],
};
const ALL_GENRES: BookGenre[] = [
  "fantasy",
  "horror",
  "romance",
  "adventure",
  "mystery",
  "science_fiction",
  "historical_fiction",
  "literary_fiction",
  "thriller",
  "childrens_fiction",
  "classic_literature",
  "gothic",
  "crime",
  "biography",
  "short_stories",
];

const LISTING_PREFS = ["published", "unlisted"] as const satisfies readonly ListingPreferenceAfterReview[];

function parseListingPreference(raw: unknown): ListingPreferenceAfterReview | null | "invalid" {
  if (raw === null) return null;
  if (typeof raw !== "string" || !(LISTING_PREFS as readonly string[]).includes(raw)) {
    return "invalid";
  }
  return raw as ListingPreferenceAfterReview;
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({ where: { clerkId: user.clerkId } });
  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { id } = await context.params;
  const existing = await prisma.book.findFirst({ where: { id, deletedAt: null } });
  if (!existing) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }
  if (existing.ownerId !== dbUser.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const data: {
    title?: string;
    author?: string;
    genre?: BookGenre | null;
    publishedYear?: number | null;
    description?: string | null;
    status?: BookStatus;
    rejectionReason?: string | null;
    listingPreferenceAfterReview?: ListingPreferenceAfterReview | null;
  } = {};

  if ("title" in b) {
    if (typeof b.title !== "string") {
      return NextResponse.json({ error: "title must be a string" }, { status: 400 });
    }
    data.title = b.title;
  }
  if ("author" in b) {
    if (typeof b.author !== "string") {
      return NextResponse.json({ error: "author must be a string" }, { status: 400 });
    }
    data.author = b.author;
  }
  if ("genre" in b) {
    if (b.genre === null || b.genre === "") {
      data.genre = null;
    } else if (typeof b.genre === "string" && (ALL_GENRES as string[]).includes(b.genre)) {
      data.genre = b.genre as BookGenre;
    } else {
      return NextResponse.json({ error: "genre must be a BookGenre or null" }, { status: 400 });
    }
  }
  if ("publishedYear" in b) {
    if (b.publishedYear === null || b.publishedYear === "") {
      data.publishedYear = null;
    } else if (typeof b.publishedYear === "number" && Number.isInteger(b.publishedYear)) {
      data.publishedYear = b.publishedYear;
    } else {
      return NextResponse.json(
        { error: "publishedYear must be an integer, null, or empty" },
        { status: 400 },
      );
    }
  }
  if ("description" in b) {
    if (b.description !== null && typeof b.description !== "string") {
      return NextResponse.json(
        { error: "description must be a string or null" },
        { status: 400 },
      );
    }
    data.description = b.description === null || b.description === "" ? null : b.description;
  }

  /** Draft-only: save catalogue vs unlisted intent before submit. */
  if ("listingPreferenceAfterReview" in b && !("status" in b)) {
    const parsed = parseListingPreference(b.listingPreferenceAfterReview);
    if (parsed === "invalid") {
      return NextResponse.json(
        { error: "listingPreferenceAfterReview must be 'published', 'unlisted', or null" },
        { status: 400 },
      );
    }
    if (existing.status !== "draft") {
      return NextResponse.json(
        { error: "listingPreferenceAfterReview may only be set while the book is a draft" },
        { status: 400 },
      );
    }
    data.listingPreferenceAfterReview =
      parsed === null ? ListingPreferenceAfterReview.published : parsed;
  }

  if ("status" in b) {
    if (typeof b.status !== "string") {
      return NextResponse.json({ error: "status must be a BookStatus" }, { status: 400 });
    }
    if (!(ALL_STATUSES as string[]).includes(b.status)) {
      return NextResponse.json({ error: "status must be a BookStatus" }, { status: 400 });
    }
    const next = b.status as BookStatus;
    if (next !== existing.status) {
      const allowed = ALLOWED_TRANSITIONS[existing.status] ?? [];
      if (!allowed.includes(next)) {
        return NextResponse.json(
          { error: `Forbidden status transition from ${existing.status} to ${next}` },
          { status: 403 },
        );
      }
    }
    data.status = next;

    if (existing.status === "draft" && next === "pending_review") {
      if ("listingPreferenceAfterReview" in b) {
        const parsed = parseListingPreference(b.listingPreferenceAfterReview);
        if (parsed === "invalid") {
          return NextResponse.json(
            { error: "listingPreferenceAfterReview must be 'published', 'unlisted', or null" },
            { status: 400 },
          );
        }
        data.listingPreferenceAfterReview =
          parsed === null ? ListingPreferenceAfterReview.published : parsed;
      } else {
        data.listingPreferenceAfterReview =
          existing.listingPreferenceAfterReview ?? ListingPreferenceAfterReview.published;
      }
    }

    if (
      next === "draft" &&
      (existing.status === "pending_review" || existing.status === "rejected")
    ) {
      data.listingPreferenceAfterReview = null;
      if (existing.status === "rejected") {
        data.rejectionReason = null;
      }
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      {
        error:
          "Provide at least one of: title, author, genre, publishedYear, description, status, listingPreferenceAfterReview",
      },
      { status: 400 },
    );
  }

  const book = await prisma.book.update({
    where: { id },
    data,
    include: { _count: { select: { chapters: true } } },
  });

  return NextResponse.json({ book });
}
