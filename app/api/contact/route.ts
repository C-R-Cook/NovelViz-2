import { NextResponse } from "next/server";

const ALLOWED_SUBJECTS = new Set([
  "general",
  "technical",
  "partnership",
  "press",
  "issue",
]);

type Body = {
  name?: unknown;
  email?: unknown;
  subject?: unknown;
  message?: unknown;
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Contact form intake. TODO: send email (e.g. Resend) instead of logging only.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, email, subject, message } = body;

  if (!isNonEmptyString(name)) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!isNonEmptyString(email)) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }
  if (typeof subject !== "string" || !ALLOWED_SUBJECTS.has(subject)) {
    return NextResponse.json({ error: "Invalid subject" }, { status: 400 });
  }
  if (!isNonEmptyString(message) || message.trim().length < 20) {
    return NextResponse.json(
      { error: "Message must be at least 20 characters" },
      { status: 400 },
    );
  }

  console.info("[contact] submission", {
    name: name.trim(),
    email: email.trim(),
    subject,
    messageLength: message.trim().length,
  });

  return NextResponse.json({ success: true });
}
