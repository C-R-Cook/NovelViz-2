/**
 * Delete Imagine/gallery GeneratedImage rows and their Cloudinary assets together.
 *
 *   npx tsx scripts/cleanup-gallery-images.ts --dry-run
 *   npx tsx scripts/cleanup-gallery-images.ts --apply
 *
 * Uses DATABASE_URL (or DIRECT_URL). Requires Cloudinary credentials in env.
 * Deletes assets under legacy + dev/prod gallery folders, then removes DB rows
 * (comments, likes, and feature requests cascade from GeneratedImage).
 */
import "./lib/load-env";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@db";
import cloudinary, {
  LEGACY_CLOUDINARY_GALLERY_PREFIX,
  isCloudinaryHttpsUrl,
} from "@/lib/cloudinary";

const GALLERY_PREFIXES = [
  LEGACY_CLOUDINARY_GALLERY_PREFIX.replace(/\/$/, ""),
  "novelviz/dev/gallery",
  "novelviz/prod/gallery",
] as const;

type Resource = { public_id: string };

function parseArgs(argv: string[]) {
  let apply = false;
  for (const arg of argv) {
    if (arg === "--apply") apply = true;
    else if (arg === "--dry-run") apply = false;
  }
  return { apply };
}

function cloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_URL?.trim() ||
      (process.env.CLOUDINARY_CLOUD_NAME?.trim() &&
        process.env.CLOUDINARY_API_KEY?.trim() &&
        process.env.CLOUDINARY_API_SECRET?.trim()),
  );
}

/** Extract Cloudinary public_id from a delivery URL (no file extension). */
function publicIdFromCloudinaryUrl(url: string): string | null {
  if (!isCloudinaryHttpsUrl(url)) return null;
  try {
    const parsed = new URL(url);
    const uploadIdx = parsed.pathname.indexOf("/upload/");
    if (uploadIdx === -1) return null;
    let rest = parsed.pathname.slice(uploadIdx + "/upload/".length);
    // Drop version segment v1234567890
    rest = rest.replace(/^v\d+\//, "");
    // Drop file extension
    return rest.replace(/\.[a-z0-9]+$/i, "") || null;
  } catch {
    return null;
  }
}

async function listGalleryResources(prefix: string): Promise<Resource[]> {
  const out: Resource[] = [];
  let nextCursor: string | undefined;
  do {
    const page = (await cloudinary.api.resources({
      type: "upload",
      resource_type: "image",
      prefix,
      max_results: 500,
      ...(nextCursor ? { next_cursor: nextCursor } : {}),
    })) as { resources: Resource[]; next_cursor?: string };
    out.push(...(page.resources ?? []));
    nextCursor = page.next_cursor;
  } while (nextCursor);
  return out;
}

async function main() {
  const { apply } = parseArgs(process.argv.slice(2));

  if (!cloudinaryConfigured()) {
    throw new Error(
      "Set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET",
    );
  }

  const connectionString = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaNeon({ connectionString }),
  });

  const images = await prisma.generatedImage.findMany({
    select: { id: true, imageUrl: true, userPrompt: true },
    orderBy: { createdAt: "asc" },
  });

  const dbPublicIds = new Set<string>();
  for (const row of images) {
    const publicId = publicIdFromCloudinaryUrl(row.imageUrl);
    if (publicId) dbPublicIds.add(publicId);
  }

  const cloudinaryPublicIds = new Set<string>();
  for (const prefix of GALLERY_PREFIXES) {
    const batch = await listGalleryResources(prefix);
    for (const resource of batch) {
      cloudinaryPublicIds.add(resource.public_id);
    }
  }

  const allPublicIds = new Set([...dbPublicIds, ...cloudinaryPublicIds]);

  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);
  console.log(`GeneratedImage rows: ${images.length}`);
  console.log(`Cloudinary gallery assets: ${cloudinaryPublicIds.size}`);
  console.log(`Unique public_ids to remove: ${allPublicIds.size}`);

  if (!apply) {
    for (const row of images.slice(0, 20)) {
      console.log(`  db row: ${row.id} — ${row.userPrompt.slice(0, 60)}…`);
    }
    if (images.length > 20) console.log(`  … and ${images.length - 20} more`);
    for (const publicId of [...allPublicIds].slice(0, 20)) {
      console.log(`  cloudinary: ${publicId}`);
    }
    if (allPublicIds.size > 20) console.log(`  … and ${allPublicIds.size - 20} more`);
    await prisma.$disconnect();
    return;
  }

  let cloudinaryDeleted = 0;
  let cloudinaryErrors = 0;
  for (const publicId of allPublicIds) {
    try {
      await cloudinary.uploader.destroy(publicId, { invalidate: true, resource_type: "image" });
      cloudinaryDeleted += 1;
    } catch (e) {
      cloudinaryErrors += 1;
      console.error(`  ✗ cloudinary ${publicId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const notifications = await prisma.notification.deleteMany({
    where: { link: { contains: "/gallery/" } },
  });

  const deletedImages = await prisma.generatedImage.deleteMany({});

  console.log("");
  console.log(
    `Done. cloudinaryDeleted=${cloudinaryDeleted} cloudinaryErrors=${cloudinaryErrors} dbImages=${deletedImages.count} notifications=${notifications.count}`,
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
