import { Resend } from "resend";

export const AdminEmailCategory = {
  CONTACT: "CONTACT",
  SPOILER_FLAG: "SPOILER-FLAG",
  COMMENT_FLAG: "COMMENT-FLAG",
  BOOK_REQUEST: "BOOK-REQUEST",
  FEATURE_REQUEST: "FEATURE-REQUEST",
  PARTNER_REQUEST: "PARTNER-REQUEST",
  COVER_AI_REQUEST: "COVER-AI-REQUEST",
  ACCOUNT_APPEAL: "ACCOUNT-APPEAL",
} as const;

export type AdminEmailCategory = (typeof AdminEmailCategory)[keyof typeof AdminEmailCategory];

const SUBJECT_DETAIL_MAX = 120;

export type AdminEmailBodyLine = {
  label: string;
  value: string;
};

export type SendAdminEmailInput = {
  category: AdminEmailCategory;
  subjectDetail: string;
  bodyLines: AdminEmailBodyLine[];
  replyTo?: string;
};

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

function getAdminNotificationEmail(): string | null {
  const email = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();
  return email && email.includes("@") ? email : null;
}

function getEmailFrom(): string | null {
  const from = process.env.EMAIL_FROM?.trim();
  return from && from.length > 0 ? from : null;
}

/** Base URL for absolute links in email bodies. */
export function getAppBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return `https://${vercelUrl.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}

export function buildAdminEmailSubject(
  category: AdminEmailCategory,
  subjectDetail: string,
): string {
  const detail = subjectDetail.trim().slice(0, SUBJECT_DETAIL_MAX);
  return `[${category}] - ${detail}`;
}

export function buildAdminEmailBody(bodyLines: AdminEmailBodyLine[]): string {
  return bodyLines
    .map(({ label, value }) => `${label}: ${value}`)
    .join("\n");
}

export function absoluteAppUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getAppBaseUrl()}${normalized}`;
}

/** Contact form subject enum → human-readable label. */
export const CONTACT_SUBJECT_LABELS: Record<string, string> = {
  general: "General enquiry",
  technical: "Technical support",
  partnership: "Partnership / publishing enquiry",
  press: "Press enquiry",
  issue: "Report an issue",
};

async function sendAdminEmailNow(input: SendAdminEmailInput): Promise<boolean> {
  const to = getAdminNotificationEmail();
  const from = getEmailFrom();
  const subject = buildAdminEmailSubject(input.category, input.subjectDetail);
  const text = buildAdminEmailBody(input.bodyLines);

  if (!to || !from) {
    console.info("[admin-email] skipped (missing ADMIN_NOTIFICATION_EMAIL or EMAIL_FROM)", {
      category: input.category,
      subject,
      to: to ?? "(unset)",
      from: from ?? "(unset)",
    });
    return false;
  }

  const resend = getResendClient();
  if (!resend) {
    console.info("[admin-email] would send (RESEND_API_KEY not set)", {
      to,
      from,
      subject,
      replyTo: input.replyTo,
      text,
    });
    return false;
  }

  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    text,
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
  });

  if (error) {
    console.error("[admin-email] send failed", { category: input.category, error });
    return false;
  }

  return true;
}

/** Fire-and-forget admin notification. Never throws to callers. */
export function sendAdminEmail(input: SendAdminEmailInput): void {
  void sendAdminEmailNow(input).catch((err) => {
    console.error("[admin-email] unexpected error", { category: input.category, err });
  });
}

/** Await delivery — use when the caller must finish sending before the request ends (e.g. serverless). */
export async function sendAdminEmailAsync(input: SendAdminEmailInput): Promise<boolean> {
  try {
    return await sendAdminEmailNow(input);
  } catch (err) {
    console.error("[admin-email] unexpected error", { category: input.category, err });
    return false;
  }
}
