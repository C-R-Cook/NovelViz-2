import { requireAdminApi } from "@/lib/admin-auth";
import { addCreditTransaction, getCreditBalance, getCreditTransactions } from "@/lib/credits";
import { prisma } from "@/lib/prisma";
import { CreditTransactionReason } from "@db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ userId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { userId } = await context.params;
  const [balance, transactions] = await Promise.all([
    getCreditBalance(userId),
    getCreditTransactions(userId, { limit: 100 }),
  ]);

  return NextResponse.json({
    balance,
    transactions: transactions.map((t) => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { userId } = await context.params;
  const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!Number.isInteger(amount) || amount === 0) {
    return NextResponse.json({ error: "amount must be a non-zero integer" }, { status: 400 });
  }

  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!note) return NextResponse.json({ error: "note is required" }, { status: 400 });

  await addCreditTransaction({
    userId,
    amount,
    reason: CreditTransactionReason.ADMIN_ADJUST,
    grantedBy: auth.user.id,
    note,
  });

  const balance = await getCreditBalance(userId);
  return NextResponse.json({ balance });
}
