import { ensureCurrentUser } from "@/lib/auth";
import { resolvePostAuthRedirect } from "@/lib/session-profile";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Poll-friendly check: DB user provisioned and post-auth redirect resolved. */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ready: false, reason: "no_clerk_session" });
  }

  const session = await ensureCurrentUser(12);
  if (!session) {
    return NextResponse.json({ ready: false, reason: "provisioning" });
  }

  const redirectTo = await resolvePostAuthRedirect(session);
  return NextResponse.json({ ready: true, redirectTo });
}
