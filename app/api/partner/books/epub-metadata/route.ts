import { getCurrentUser } from "@/lib/auth";
import { extractEpubMetadataFromOpf, openEpubPackage } from "@/lib/ingestion";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".epub")) {
    return NextResponse.json({ error: "Only .epub is supported" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { opfXml } = await openEpubPackage(buffer);
    const metadata = extractEpubMetadataFromOpf(opfXml);
    return NextResponse.json({
      metadata: {
        title: metadata.title ?? null,
        author: metadata.author ?? null,
        description: metadata.description ?? null,
        genre: metadata.genre ?? null,
        publishedYear: metadata.publishedYear ?? null,
      },
    });
  } catch (e) {
    console.error("[epub metadata]", e);
    return NextResponse.json(
      { error: "Could not read metadata from EPUB" },
      { status: 400 },
    );
  }
}
