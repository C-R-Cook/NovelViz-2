import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { Prisma, SubscriptionTier, UserRole } from "@db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const PAGE_SIZE = 50;

const SORT_FIELDS = new Set(["createdAt", "email", "username", "subscriptionTier", "name"]);

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim() ?? "";
  const pageRaw = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;
  const sort = url.searchParams.get("sort") ?? "createdAt";
  const order = url.searchParams.get("order") === "asc" ? "asc" : "desc";
  const sortField = SORT_FIELDS.has(sort) ? sort : "createdAt";

  const where: Prisma.UserWhereInput = search
    ? {
        OR: [
          { email: { contains: search, mode: "insensitive" } },
          { username: { contains: search, mode: "insensitive" } },
          { name: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};

  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { [sortField]: order },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        clerkId: true,
        username: true,
        name: true,
        email: true,
        role: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        createdAt: true,
        badges: { where: { badgeKey: "OG_BETA" }, select: { id: true }, take: 1 },
      },
    }),
  ]);

  return NextResponse.json({
    users: rows.map((u) => ({
      id: u.id,
      clerkId: u.clerkId,
      username: u.username ?? "",
      name: u.name ?? "",
      email: u.email,
      role: u.role as UserRole,
      subscriptionTier: u.subscriptionTier as SubscriptionTier,
      subscriptionStatus: u.subscriptionStatus,
      createdAt: u.createdAt.toISOString(),
      hasOgBadge: u.badges.length > 0,
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
  });
}
