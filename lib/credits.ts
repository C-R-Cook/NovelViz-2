import { prisma } from "@/lib/prisma";
import { CreditTransactionReason } from "@db";

export async function getCreditBalance(userId: string): Promise<number> {
  const agg = await prisma.creditTransaction.aggregate({
    where: { userId },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}

export async function getCreditTransactions(
  userId: string,
  options?: { limit?: number; offset?: number },
): Promise<
  Array<{
    id: string;
    amount: number;
    reason: string;
    bookId: string | null;
    note: string | null;
    createdAt: Date;
  }>
> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  return prisma.creditTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
    select: {
      id: true,
      amount: true,
      reason: true,
      bookId: true,
      note: true,
      createdAt: true,
    },
  });
}

export async function addCreditTransaction(params: {
  userId: string;
  amount: number;
  reason: CreditTransactionReason;
  bookId?: string | null;
  creditPackId?: string | null;
  stripePaymentIntentId?: string | null;
  grantedBy?: string | null;
  note?: string | null;
}): Promise<void> {
  await prisma.creditTransaction.create({
    data: {
      userId: params.userId,
      amount: params.amount,
      reason: params.reason,
      bookId: params.bookId ?? null,
      creditPackId: params.creditPackId ?? null,
      stripePaymentIntentId: params.stripePaymentIntentId ?? null,
      grantedBy: params.grantedBy ?? null,
      note: params.note ?? null,
    },
  });
}

/** Zero credit balance via immutable ledger entry when account is permanently terminated. */
export async function forfeitCreditsOnTermination(
  userId: string,
  note?: string | null,
): Promise<void> {
  const balance = await getCreditBalance(userId);
  if (balance <= 0) return;

  await addCreditTransaction({
    userId,
    amount: -balance,
    reason: CreditTransactionReason.FORFEITED_TERMINATION,
    note: note ?? "Credits forfeited on permanent account termination",
  });
}

export async function spendCreditsIfNeeded(params: {
  userId: string;
  type: "query" | "image";
  bookId: string;
  monthlyUsed: number;
  monthlyLimit: number | null;
  creditCost: number;
}): Promise<void> {
  const { userId, type, bookId, monthlyUsed, monthlyLimit, creditCost } = params;
  if (monthlyLimit === null || monthlyUsed <= monthlyLimit) {
    return;
  }
  if (creditCost <= 0) return;

  const balance = await getCreditBalance(userId);
  if (balance < creditCost) {
    console.warn("[credits] spendCreditsIfNeeded: insufficient balance", { userId, type, balance, creditCost });
    return;
  }

  await addCreditTransaction({
    userId,
    amount: -creditCost,
    reason: type === "query" ? CreditTransactionReason.SPEND_QUERY : CreditTransactionReason.SPEND_IMAGE,
    bookId,
  });
}
