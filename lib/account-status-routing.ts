import { getCurrentUser } from "@/lib/auth";
import { getEnforcementRedirectPath } from "@/lib/account-enforcement";
import { prisma } from "@/lib/prisma";
import { AccountStatus } from "@db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

/** Paths enforced accounts may still visit (landing + status page + auth). */
const ENFORCED_ALLOWED_EXACT_PATHS: Record<"suspended" | "terminated", readonly string[]> = {
  suspended: ["/", "/account/suspended"],
  terminated: ["/", "/account/terminated"],
};

const ENFORCED_ALLOWED_PATH_PREFIXES = [
  "/login",
  "/sign-in",
  "/sign-up",
  "/register",
  "/api/account/appeal",
  "/api/webhooks",
] as const;

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function isPathAllowedForEnforcedAccount(
  pathname: string,
  status: AccountStatus,
): boolean {
  if (status === AccountStatus.active) return true;

  const normalized = normalizePathname(pathname);
  const allowedExact =
    status === AccountStatus.suspended
      ? ENFORCED_ALLOWED_EXACT_PATHS.suspended
      : ENFORCED_ALLOWED_EXACT_PATHS.terminated;

  if (allowedExact.includes(normalized)) return true;

  return ENFORCED_ALLOWED_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}

export function isApiPathAllowedForEnforcedAccount(
  pathname: string,
  status: AccountStatus,
): boolean {
  if (status === AccountStatus.active) return true;
  return isPathAllowedForEnforcedAccount(pathname, status);
}

async function getRequestPathname(): Promise<string | null> {
  const headerList = await headers();
  const fromHeader = headerList.get("x-pathname");
  if (fromHeader) return fromHeader;

  const url = headerList.get("x-url") ?? headerList.get("next-url");
  if (url) {
    try {
      return new URL(url, "http://localhost").pathname;
    } catch {
      // fall through
    }
  }

  return null;
}

async function redirectEnforcedSession(sessionId: string): Promise<void> {
  const block = await getAccountEnforcementBlock(sessionId);
  if (!block.blocked) return;
  redirect(getEnforcementRedirectPath(block.status)!);
}

/** Redirect enforced accounts away from app routes that never include status/landing pages. */
export async function enforceAccountAccessForRestrictedPages(): Promise<void> {
  const session = await getCurrentUser();
  if (!session) return;
  await redirectEnforcedSession(session.id);
}

/** Redirect enforced accounts away from routes outside the landing/status allowlist. */
export async function enforceAccountAccessForPage(): Promise<void> {
  const session = await getCurrentUser();
  if (!session) return;

  const block = await getAccountEnforcementBlock(session.id);
  if (!block.blocked) return;

  const pathname = await getRequestPathname();
  if (!pathname) {
    redirect(getEnforcementRedirectPath(block.status)!);
  }

  if (isPathAllowedForEnforcedAccount(pathname, block.status)) return;

  redirect(getEnforcementRedirectPath(block.status)!);
}

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

/** Like accountEnforcementApiGuard but respects appeal/webhook API allowlist. */
export async function accountEnforcementApiGuardForRequest(
  request: Request,
  userId: string,
): Promise<NextResponse | null> {
  const block = await getAccountEnforcementBlock(userId);
  if (!block.blocked) return null;

  const pathname = new URL(request.url).pathname;
  if (isApiPathAllowedForEnforcedAccount(pathname, block.status)) return null;

  return accountEnforcementApiGuard(userId);
}
