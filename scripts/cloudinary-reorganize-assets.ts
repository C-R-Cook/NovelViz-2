/**
 * Reorganize Cloudinary assets into novelviz/{dev|prod}/… with covers/user|ai split.
 *
 *   npx tsx scripts/cloudinary-reorganize-assets.ts --target prod --dry-run
 *   npx tsx scripts/cloudinary-reorganize-assets.ts --target prod --apply
 *
 * Uses DATABASE_URL (or DIRECT_URL) for Book / GeneratedImage URL updates.
 * Requires CLOUDINARY_URL in env.
 */
import "./lib/load-env";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@db";
import cloudinary, {
  type CloudinaryEnvFolder,
  LEGACY_CLOUDINARY_COVERS_PREFIX,
  LEGACY_CLOUDINARY_DRAFT_PREFIX,
  LEGACY_CLOUDINARY_GALLERY_PREFIX,
} from "@/lib/cloudinary";

type Resource = { public_id: string; secure_url?: string };

function parseArgs(argv: string[]) {
  let target: CloudinaryEnvFolder = "prod";
  let apply = false;
  for (const arg of argv) {
    if (arg === "--apply") apply = true;
    else if (arg === "--dry-run") apply = false;
    else if (arg.startsWith("--target=")) {
      const v = arg.split("=")[1]?.trim();
      if (v === "dev" || v === "prod") target = v;
    } else if (arg === "--target" || arg === "-t") {
      // handled below via index — skip
    }
  }
  const targetIdx = argv.findIndex((a) => a === "--target" || a === "-t");
  if (targetIdx >= 0) {
    const v = argv[targetIdx + 1]?.trim();
    if (v === "dev" || v === "prod") target = v;
  }
  return { target, apply };
}

async function listAllResources(prefix: string): Promise<Resource[]> {
  const out: Resource[] = [];
  let nextCursor: string | undefined;
  do {
    const page = (await cloudinary.api.resources({
      type: "upload",
      resource_type: "image",
      prefix,
      max_results: 500,
      ...(nextCursor ? { next_cursor: nextCursor } : {}),
    })) as {
      resources: Resource[];
      next_cursor?: string;
    };
    out.push(...(page.resources ?? []));
    nextCursor = page.next_cursor;
  } while (nextCursor);
  return out;
}

function resolveNewPublicId(
  publicId: string,
  target: CloudinaryEnvFolder,
  coverIsAi: Map<string, boolean>,
): string | null {
  const root = `novelviz/${target}`;

  if (
    publicId.startsWith(`${root}/covers/user/`) ||
    publicId.startsWith(`${root}/covers/ai/`) ||
    publicId.startsWith(`${root}/gallery/`) ||
    publicId.startsWith(`${root}/cover-drafts/`)
  ) {
    return null;
  }

  if (publicId.startsWith(LEGACY_CLOUDINARY_GALLERY_PREFIX)) {
    const rest = publicId.slice(LEGACY_CLOUDINARY_GALLERY_PREFIX.length);
    if (!rest) return null;
    return `${root}/gallery/${rest}`;
  }

  if (publicId.startsWith(LEGACY_CLOUDINARY_DRAFT_PREFIX)) {
    const rest = publicId.slice(LEGACY_CLOUDINARY_DRAFT_PREFIX.length);
    if (!rest) return null;
    return `${root}/cover-drafts/${rest}`;
  }

  if (publicId.startsWith(LEGACY_CLOUDINARY_COVERS_PREFIX)) {
    const bookId = publicId.slice(LEGACY_CLOUDINARY_COVERS_PREFIX.length);
    if (!bookId || bookId.includes("/")) return null;
    const ai = coverIsAi.get(bookId) ?? false;
    return `${root}/covers/${ai ? "ai" : "user"}/${bookId}`;
  }

  const flatEnvCover = publicId.match(/^novelviz\/(dev|prod)\/covers\/([^/]+)$/);
  if (flatEnvCover) {
    const bookId = flatEnvCover[2]!;
    const ai = coverIsAi.get(bookId) ?? false;
    return `${root}/covers/${ai ? "ai" : "user"}/${bookId}`;
  }

  const wrongEnvGallery = publicId.match(/^novelviz\/(dev|prod)\/gallery\/(.+)$/);
  if (wrongEnvGallery && wrongEnvGallery[1] !== target) {
    return `${root}/gallery/${wrongEnvGallery[2]}`;
  }

  const wrongEnvDrafts = publicId.match(/^novelviz\/(dev|prod)\/cover-drafts\/(.+)$/);
  if (wrongEnvDrafts && wrongEnvDrafts[1] !== target) {
    return `${root}/cover-drafts/${wrongEnvDrafts[2]}`;
  }

  return null;
}

async function replaceUrlInDb(
  prisma: PrismaClient,
  oldUrl: string,
  newUrl: string,
): Promise<{ books: number; images: number }> {
  const books = await prisma.book.updateMany({
    where: { coverImageUrl: oldUrl },
    data: { coverImageUrl: newUrl },
  });
  const images = await prisma.generatedImage.updateMany({
    where: { imageUrl: oldUrl },
    data: { imageUrl: newUrl },
  });
  return { books: books.count, images: images.count };
}

async function main() {
  const { target, apply } = parseArgs(process.argv.slice(2));

  if (!process.env.CLOUDINARY_URL?.trim()) {
    throw new Error("CLOUDINARY_URL is not set");
  }

  const connectionString = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaNeon({ connectionString }),
  });

  const bookRows = await prisma.book.findMany({
    select: { id: true, coverIsAiGenerated: true },
  });
  const coverIsAi = new Map(bookRows.map((b) => [b.id, b.coverIsAiGenerated]));

  const prefixes = [
    LEGACY_CLOUDINARY_GALLERY_PREFIX.replace(/\/$/, ""),
    LEGACY_CLOUDINARY_COVERS_PREFIX.replace(/\/$/, ""),
    LEGACY_CLOUDINARY_DRAFT_PREFIX.replace(/\/$/, ""),
    `novelviz/${target}`,
  ];

  const seen = new Set<string>();
  const resources: Resource[] = [];
  for (const prefix of prefixes) {
    const batch = await listAllResources(prefix);
    for (const r of batch) {
      if (!seen.has(r.public_id)) {
        seen.add(r.public_id);
        resources.push(r);
      }
    }
  }

  console.log(`Target env: ${target} | Mode: ${apply ? "APPLY" : "DRY RUN"}`);
  console.log(`Scanned ${resources.length} Cloudinary image(s)`);

  let renamed = 0;
  let skipped = 0;
  let dbBookUpdates = 0;
  let dbImageUpdates = 0;
  let errors = 0;

  for (const resource of resources) {
    const fromId = resource.public_id;
    const toId = resolveNewPublicId(fromId, target, coverIsAi);
    if (!toId) {
      skipped += 1;
      continue;
    }

    console.log(`  ${apply ? "rename" : "would rename"}: ${fromId} → ${toId}`);

    if (!apply) {
      renamed += 1;
      continue;
    }

    try {
      const result = await cloudinary.uploader.rename(fromId, toId, {
        overwrite: true,
        invalidate: true,
      });
      renamed += 1;
      const oldUrl = resource.secure_url;
      const newUrl = result.secure_url as string;
      if (oldUrl && newUrl && oldUrl !== newUrl) {
        const counts = await replaceUrlInDb(prisma, oldUrl, newUrl);
        dbBookUpdates += counts.books;
        dbImageUpdates += counts.images;
      }
    } catch (e) {
      errors += 1;
      console.error(`  ✗ ${fromId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log("");
  console.log(
    `Done. renamed=${renamed} skipped=${skipped} errors=${errors} dbBooks=${dbBookUpdates} dbImages=${dbImageUpdates}`,
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
