import { getCurrentUser } from "@/lib/auth";
import {
  PARTNER_QUERIES_PAGE_SIZE,
  parsePartnerQueriesTake,
  queryPartnerQueriesPage,
} from "@/lib/partner-queries";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@db";
import { NextResponse } from "next/server";

/** Paginated Q&A on the caller's owned books. Partners and admins only. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role === UserRole.reader) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const dbUser = await prisma.user.findUnique({ where: { clerkId: user.clerkId } });
  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const skipRaw = url.searchParams.get("skip");
  const parsed = skipRaw === null || skipRaw === "" ? 0 : Number.parseInt(skipRaw, 10);
  const skip = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  const take = parsePartnerQueriesTake(url.searchParams.get("take"));

  const { rows, hasMore } = await queryPartnerQueriesPage({
    ownerId: dbUser.id,
    skip,
    take,
  });

  return NextResponse.json({
    queries: rows,
    hasMore,
    pageSize: PARTNER_QUERIES_PAGE_SIZE,
  });
}
