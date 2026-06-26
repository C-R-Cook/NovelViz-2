import { prisma } from "@/lib/prisma";
import { isValidUsernameFormat, normalizeUsername } from "@/lib/username";

export type ClaimUsernameResult =
  | { ok: true; username: string }
  | { ok: false; error: string; status: number };

export async function isUsernameAvailable(
  username: string,
  excludeUserId?: string,
): Promise<boolean> {
  const existing = await prisma.user.findFirst({
    where: {
      username: { equals: username, mode: "insensitive" },
      ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
    },
    select: { id: true },
  });
  return !existing;
}

/** Reserve a username on the NovelViz user row (case-insensitive unique). */
export async function claimUsername(
  userId: string,
  usernameRaw: string,
  options?: { skipIfSet?: boolean },
): Promise<ClaimUsernameResult> {
  const username = normalizeUsername(usernameRaw);
  if (!isValidUsernameFormat(username)) {
    return { ok: false, error: "Invalid username", status: 400 };
  }

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true },
  });
  if (!me) {
    return { ok: false, error: "User not found", status: 404 };
  }

  const current = me.username?.trim().toLowerCase() ?? "";
  if (current) {
    if (options?.skipIfSet && current === username) {
      return { ok: true, username: current };
    }
    if (current === username) {
      return { ok: true, username: current };
    }
    return { ok: false, error: "Username already set", status: 400 };
  }

  const available = await isUsernameAvailable(username, userId);
  if (!available) {
    return { ok: false, error: "Username already taken", status: 409 };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { username },
    });
  } catch {
    return { ok: false, error: "Username already taken", status: 409 };
  }

  return { ok: true, username };
}
