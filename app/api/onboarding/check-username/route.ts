import { isUsernameAvailable } from "@/lib/claim-username";
import { isValidUsernameFormat, normalizeUsername } from "@/lib/username";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("username") ?? "";
  const username = normalizeUsername(raw);

  if (!username) {
    return NextResponse.json({ available: false, valid: false });
  }

  if (!isValidUsernameFormat(username)) {
    return NextResponse.json({ available: false, valid: false });
  }

  const excludeUserId = searchParams.get("excludeUserId")?.trim() || undefined;
  const available = await isUsernameAvailable(username, excludeUserId);

  return NextResponse.json({
    available,
    valid: true,
  });
}
