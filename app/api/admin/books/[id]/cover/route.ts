import { getCurrentUser } from "@/lib/auth";
import cloudinary from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@db";
import { NextResponse } from "next/server";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const MAX_BYTES = 15 * 1024 * 1024;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: bookId } = await context.params;

  const existing = await prisma.book.findFirst({ where: { id: bookId, deletedAt: null } });
  if (!existing) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }
  if (user.role !== UserRole.admin && existing.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Only .jpg, .jpeg, .png, and .webp images are allowed" },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 15MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type === "image/jpg" ? "image/jpeg" : file.type;
  const dataUri = `data:${mime};base64,${buffer.toString("base64")}`;

  let secureUrl: string;
  try {
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: "novelviz/covers",
      public_id: bookId,
      overwrite: true,
      transformation: [{ width: 400, height: 600, crop: "fit" }],
      resource_type: "image",
    });
    secureUrl = result.secure_url;
  } catch (e) {
    console.error("[cover upload] Cloudinary error:", e);
    return NextResponse.json({ error: "Image upload failed" }, { status: 502 });
  }

  const [book, chapterCount] = await prisma.$transaction([
    prisma.book.update({
      where: { id: bookId },
      data: { coverImageUrl: secureUrl },
    }),
    prisma.chapter.count({ where: { bookId } }),
  ]);

  return NextResponse.json({
    book: {
      ...book,
      chapterCount,
    },
  });
}
