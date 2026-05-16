import { getCurrentUser } from "@/lib/auth";
import { UserRole } from "@db";
import { NextResponse } from "next/server";

export async function requireAdminApi(): Promise<
  | { ok: true; user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>> }
  | { ok: false; response: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (user.role !== UserRole.admin) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, user };
}
