import fal from "@/lib/fal";
import { absoluteAppUrl } from "@/lib/admin-email";
import {
  CONTENT_TEST_PLACEHOLDER_IMAGE_URL,
  getSupplierBlockReason,
  isSupplierBlocked,
  logSupplierSkipped,
} from "@/lib/content-test-mode";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getT2iOutputRoot, sanitizePathSegment, safeJoinUnderRoot } from "@/lib/t2i-local-output";
import { UserRole } from "@db";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";

export const maxDuration = 300;

const LOG_PREFIX = "[api/admin/t2i-test POST]";

const FAL_GPT_IMAGE_15_ENDPOINT = "fal-ai/gpt-image-1.5";
const FAL_GROK_IMAGINE_IMAGE_ENDPOINT = "xai/grok-imagine-image";

/** xai/grok-imagine-image uses aspect_ratio, not image_size (fal schema). */
function grokAspectRatioFromTesterImageSize(testerSize: string): string {
  switch (testerSize) {
    case "square_hd":
      return "1:1";
    case "landscape_16_9":
      return "16:9";
    case "portrait_16_9":
      return "9:16";
    case "portrait_4_3":
    default:
      return "3:4";
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== UserRole.admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    prompt?: unknown;
    modelEndpoint?: unknown;
    modelLabel?: unknown;
    costPerImage?: unknown;
    bookId?: unknown;
    imageSize?: unknown;
    outputRunId?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const modelEndpoint = typeof body.modelEndpoint === "string" ? body.modelEndpoint.trim() : "";
  const modelLabel = typeof body.modelLabel === "string" ? body.modelLabel.trim() : "";
  const bookId = typeof body.bookId === "string" ? body.bookId.trim() : "";
  const imageSize = typeof body.imageSize === "string" ? body.imageSize.trim() : "portrait_4_3";
  const outputRunIdRaw = typeof body.outputRunId === "string" ? body.outputRunId.trim() : "";

  const falImageSize = modelEndpoint === FAL_GPT_IMAGE_15_ENDPOINT ? "1024x1024" : imageSize;

  const isGrokImagine = modelEndpoint === FAL_GROK_IMAGINE_IMAGE_ENDPOINT;

  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }
  if (!modelEndpoint) {
    return NextResponse.json({ error: "modelEndpoint is required" }, { status: 400 });
  }
  if (!modelLabel) {
    return NextResponse.json({ error: "modelLabel is required" }, { status: 400 });
  }
  if (!bookId) {
    return NextResponse.json({ error: "bookId is required" }, { status: 400 });
  }

  const chapterCount = await prisma.chapter.count({ where: { bookId } });
  if (chapterCount === 0) {
    return NextResponse.json({ error: "Book has no chapters" }, { status: 400 });
  }

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { title: true },
  });
  const bookTitle = book?.title?.trim() || "unknown-book";

  const randomChapter = Math.floor(Math.random() * chapterCount) + 1;

  const t0 = Date.now();
  let falUrl: string;
  if (isSupplierBlocked("fal")) {
    const reason = getSupplierBlockReason("fal")!;
    logSupplierSkipped("fal", reason);
    falUrl = absoluteAppUrl(CONTENT_TEST_PLACEHOLDER_IMAGE_URL);
  } else {
    try {
      const result = await fal.subscribe(modelEndpoint, {
        input: isGrokImagine
          ? {
              prompt,
              num_images: 1,
              aspect_ratio: grokAspectRatioFromTesterImageSize(imageSize),
              resolution: "1k",
              output_format: "jpeg",
            }
          : {
              prompt,
              image_size: falImageSize,
              num_images: 1,
            },
      });

      type FalImagePayload = {
        images?: Array<{ url?: string }>;
        data?: { images?: Array<{ url?: string }> };
      };
      const r = result as FalImagePayload;
      const imageUrl = r.images?.[0]?.url || r.data?.images?.[0]?.url || null;

      if (typeof imageUrl !== "string" || imageUrl === "") {
        console.error(LOG_PREFIX, "could not extract image URL; full result:", JSON.stringify(result));
        return NextResponse.json({ error: "Could not extract image URL from fal response" }, { status: 502 });
      }
      falUrl = imageUrl;
    } catch (e) {
      console.error(LOG_PREFIX, "fal error", e);
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Image generation failed" },
        { status: 502 },
      );
    }
  }

  const genTimeMs = Date.now() - t0;
  const imageId = randomUUID();

  let publicImagePath: string;
  try {
    const falImageRes = await fetch(falUrl);
    if (!falImageRes.ok) {
      console.error(LOG_PREFIX, "fetch fal image", falImageRes.status, falImageRes.statusText);
      return NextResponse.json({ error: "Failed to download generated image" }, { status: 502 });
    }
    const inputBuffer = Buffer.from(await falImageRes.arrayBuffer());

    const jpegBuffer = await sharp(inputBuffer)
      .rotate()
      .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 65, mozjpeg: true })
      .toBuffer();

    const segModel = sanitizePathSegment(modelLabel);
    const segBook = `${sanitizePathSegment(bookTitle)}__${bookId.slice(0, 8)}`;
    const runSegment = outputRunIdRaw
      ? sanitizePathSegment(outputRunIdRaw, 120)
      : sanitizePathSegment(`run_${randomUUID().slice(0, 8)}`, 120);

    const root = getT2iOutputRoot();
    const dir = safeJoinUnderRoot(root, segModel, segBook, runSegment);
    if (!dir) {
      return NextResponse.json({ error: "Invalid output path" }, { status: 400 });
    }
    await mkdir(dir, { recursive: true });

    const fileName = `${imageId}.jpg`;
    const fileAbs = safeJoinUnderRoot(root, segModel, segBook, runSegment, fileName);
    if (!fileAbs) {
      return NextResponse.json({ error: "Invalid output path" }, { status: 400 });
    }
    await writeFile(fileAbs, jpegBuffer);

    const urlSegments = [segModel, segBook, runSegment, fileName].map((s) => encodeURIComponent(s));
    publicImagePath = `/api/admin/t2i-test/serve/${urlSegments.join("/")}`;
  } catch (e) {
    console.error(LOG_PREFIX, "local image write", e);
    return NextResponse.json({ error: "Failed to save generated image locally" }, { status: 502 });
  }

  return NextResponse.json({
    imageUrl: publicImagePath,
    imageId,
    chapterNumberAtTime: randomChapter,
    genTimeMs,
    bookId,
  });
}
