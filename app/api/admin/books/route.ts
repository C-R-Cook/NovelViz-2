import { getCurrentUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  void request;
  return NextResponse.json(
    { error: "Book creation is centralized at /partner/books/new" },
    { status: 403 },
  );
}
