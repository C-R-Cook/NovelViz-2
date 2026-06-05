import { getCurrentUser } from "@/lib/auth";
import { getCreditBalance, getCreditTransactions } from "@/lib/credits";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [balance, transactions] = await Promise.all([
    getCreditBalance(session.id),
    getCreditTransactions(session.id, { limit: 50 }),
  ]);

  return NextResponse.json({
    balance,
    transactions: transactions.map((t) => ({
      id: t.id,
      amount: t.amount,
      reason: t.reason,
      bookId: t.bookId,
      note: t.note,
      createdAt: t.createdAt.toISOString(),
    })),
  });
}
