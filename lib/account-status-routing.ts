import { getCurrentUser } from "@/lib/auth";
import { getEnforcementRedirectPath } from "@/lib/account-enforcement";
import { prisma } from "@/lib/prisma";
import { AccountStatus } from "@db";
import { redirect } from "next/navigation";

/** Redirect enforced accounts away from normal app routes. */
export async function redirectIfAccountEnforced(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountStatus: true },
  });
  if (!user) return;

  const path = getEnforcementRedirectPath(user.accountStatus);
  if (path) redirect(path);
}

export async function requireAccountStatusForPage(
  expected: "suspended" | "terminated",
): Promise<{ userId: string; email: string; username: string | null }> {
  const session = await getCurrentUser();
  if (!session) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      email: true,
      username: true,
      accountStatus: true,
    },
  });

  if (!user) {
    redirect("/");
  }

  if (user.accountStatus === AccountStatus.active) {
    redirect("/library");
  }

  if (expected === "suspended") {
    if (user.accountStatus === AccountStatus.terminated) {
      redirect("/account/terminated");
    }
  } else if (user.accountStatus === AccountStatus.suspended) {
    redirect("/account/suspended");
  }

  return {
    userId: user.id,
    email: user.email,
    username: user.username,
  };
}

/** Returns 403 JSON payload code for API routes when account is enforced. */
export async function getAccountEnforcementBlock(
  userId: string,
): Promise<{ blocked: true; code: string; status: AccountStatus } | { blocked: false }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountStatus: true },
  });
  if (!user || user.accountStatus === AccountStatus.active) {
    return { blocked: false };
  }

  return {
    blocked: true,
    code: user.accountStatus === AccountStatus.suspended ? "ACCOUNT_SUSPENDED" : "ACCOUNT_TERMINATED",
    status: user.accountStatus,
  };
}

import { NextResponse } from "next/server";

/** Returns a 403 response when account is suspended/terminated, or null if allowed. */
export async function accountEnforcementApiGuard(
  userId: string,
): Promise<NextResponse | null> {
  const block = await getAccountEnforcementBlock(userId);
  if (!block.blocked) return null;

  const message =
    block.status === "suspended"
      ? "Your account is suspended. You cannot use this feature until your appeal is reviewed."
      : "Your account has been permanently terminated.";

  return NextResponse.json(
    { error: message, code: block.code },
    { status: 403 },
  );
}
