import { getCurrentUser } from "@/lib/auth";
import { parseRegisterUsernameBody, persistRegisterUsername } from "@/lib/register-intent";
import { NextResponse } from "next/server";

/** Initial gallery username claim immediately after email sign-up verification. */
export async function POST(request: Request) {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseRegisterUsernameBody(body);
  if (typeof parsed !== "string") {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await persistRegisterUsername(session.id, session.clerkId, parsed);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ username: result.username });
}
