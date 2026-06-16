import {
  AdminEmailCategory,
  CONTACT_SUBJECT_LABELS,
  sendAdminEmail,
} from "@/lib/admin-email";
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
 * Contact form intake — sends admin notification via Resend.
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

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const trimmedMessage = message.trim();
  const subjectLabel = CONTACT_SUBJECT_LABELS[subject] ?? subject;

  sendAdminEmail({
    category: AdminEmailCategory.CONTACT,
    subjectDetail: `${subjectLabel} - ${trimmedName}`,
    replyTo: trimmedEmail,
    bodyLines: [
      { label: "Name", value: trimmedName },
      { label: "Email", value: trimmedEmail },
      { label: "Subject", value: subjectLabel },
      { label: "Message", value: trimmedMessage },
    ],
  });

  return NextResponse.json({ success: true });
}
