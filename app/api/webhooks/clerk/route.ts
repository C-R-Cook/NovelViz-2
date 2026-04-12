import { verifyWebhook } from "@clerk/backend/webhooks";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const LOG_PREFIX = "[clerk-webhook]";

function logUnknownError(step: string, err: unknown) {
  const base =
    err instanceof Error
      ? {
          step,
          name: err.name,
          message: err.message,
          stack: err.stack,
          cause: err.cause,
        }
      : { step, value: String(err) };

  const extra =
    err && typeof err === "object"
      ? {
          code: "code" in err ? (err as { code?: unknown }).code : undefined,
          meta: "meta" in err ? (err as { meta?: unknown }).meta : undefined,
          clientVersion:
            "clientVersion" in err
              ? (err as { clientVersion?: unknown }).clientVersion
              : undefined,
        }
      : {};

  console.error(`${LOG_PREFIX} ${step} — error details`, { ...base, ...extra });
}

export async function POST(req: Request) {
  console.log(`${LOG_PREFIX} POST received`, {
    url: req.url,
    hasClerkSignature: req.headers.has("svix-signature"),
    hasClerkId: req.headers.has("svix-id"),
    hasClerkTimestamp: req.headers.has("svix-timestamp"),
  });

  const signingSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!signingSecret) {
    console.error(`${LOG_PREFIX} CLERK_WEBHOOK_SECRET is not set`);
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }
  console.log(`${LOG_PREFIX} CLERK_WEBHOOK_SECRET is present (length hidden)`);

  let evt: Awaited<ReturnType<typeof verifyWebhook>>;
  try {
    console.log(`${LOG_PREFIX} calling verifyWebhook`);
    evt = await verifyWebhook(req, { signingSecret });
    console.log(`${LOG_PREFIX} verifyWebhook succeeded`, {
      type: evt.type,
      object: evt.object,
    });
  } catch (verifyErr) {
    logUnknownError("verifyWebhook failed", verifyErr);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (evt.type !== "user.created") {
    console.log(`${LOG_PREFIX} skipping — event type is not user.created`, {
      type: evt.type,
    });
    return NextResponse.json({ received: true });
  }

  const { id, email_addresses, first_name, last_name, username, primary_email_address_id } =
    evt.data;

  console.log(`${LOG_PREFIX} user.created payload summary`, {
    clerkUserId: id,
    primary_email_address_id,
    emailAddressCount: email_addresses?.length ?? 0,
    emailAddressIds: email_addresses?.map((e) => e.id),
    first_name,
    last_name,
    username,
  });

  const primary =
    email_addresses?.find((e) => e.id === primary_email_address_id) ??
    email_addresses?.[0];
  const email = primary?.email_address ?? "";

  const nameFromParts = [first_name, last_name].filter(Boolean).join(" ");
  const name = nameFromParts || username || null;

  console.log(`${LOG_PREFIX} derived fields for DB`, {
    clerkId: id,
    emailLength: email.length,
    emailIsEmpty: email === "",
    name,
  });

  try {
    console.log(`${LOG_PREFIX} starting prisma.user.upsert`, {
      where: { clerkId: id },
    });
    const user = await prisma.user.upsert({
      where: { clerkId: id },
      create: {
        clerkId: id,
        email,
        name,
      },
      update: {
        email,
        name,
      },
    });
    console.log(`${LOG_PREFIX} prisma.user.upsert succeeded`, {
      dbUserId: user.id,
      clerkId: user.clerkId,
    });
  } catch (err) {
    logUnknownError("prisma.user.upsert failed", err);
    console.error(`${LOG_PREFIX} Failed to sync user from Clerk webhook (raw):`, err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  console.log(`${LOG_PREFIX} returning 200 { received: true }`);
  return NextResponse.json({ received: true });
}
