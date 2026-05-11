import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ requestId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { requestId } = await context.params;

  const reqRow = await prisma.featureRequest.findUnique({
    where: { id: requestId },
  });
  if (!reqRow) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.generatedImage.update({
      where: { id: reqRow.imageId },
      data: { isFeatured: false },
    }),
    prisma.featureRequest.delete({
      where: { id: requestId },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
