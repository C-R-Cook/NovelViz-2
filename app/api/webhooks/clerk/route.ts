import { verifyWebhook } from "@clerk/backend/webhooks";
import { NextResponse } from "next/server";

import { deleteUserDataByClerkId } from "@/lib/delete-user";
import { nameFromClerkParts } from "@/lib/display-name";
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

type ClerkUserPayload = {
  id: string;
  email_addresses?: Array<{ id: string; email_address: string }>;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  primary_email_address_id?: string | null;
};

function deriveUserFields(data: ClerkUserPayload) {
  const primary =
    data.email_addresses?.find((e) => e.id === data.primary_email_address_id) ??
    data.email_addresses?.[0];
  const email = primary?.email_address ?? null;
  const name = nameFromClerkParts(data);
  return { email, name };
}

async function upsertUserFromClerk(data: ClerkUserPayload) {
  const { email, name } = deriveUserFields(data);
  const signupDay = new Date().getDate();
  const anchorDay = Math.min(signupDay, 28);

  const user = await prisma.user.upsert({
    where: { clerkId: data.id },
    create: {
      clerkId: data.id,
      email: email ?? "",
      name,
      usagePeriodAnchor: anchorDay,
    },
    update: {
      ...(email ? { email } : {}),
      ...(name ? { name } : {}),
    },
  });

  if (process.env.BETA_MODE === "true") {
    try {
      await prisma.userBadge.create({
        data: {
          userId: user.id,
          badgeKey: "OG_BETA",
          awardedBy: null,
          note: "Awarded automatically during beta signup",
        },
      });
    } catch (badgeErr) {
      console.error(`${LOG_PREFIX} OG_BETA badge award failed`, badgeErr);
    }
  }

  return user;
}

async function syncUserFromClerk(data: ClerkUserPayload) {
  const existing = await prisma.user.findUnique({
    where: { clerkId: data.id },
    select: { id: true },
  });
  if (!existing) {
    await upsertUserFromClerk(data);
    return;
  }

  const { email, name } = deriveUserFields(data);
  const updateData: { email?: string; name?: string } = {};

  if (email) {
    updateData.email = email;
  } else {
    console.warn(`${LOG_PREFIX} user sync: no primary email in payload, skipping email update`, {
      clerkId: data.id,
    });
  }

  if (name) {
    updateData.name = name;
  }

  if (Object.keys(updateData).length === 0) {
    return;
  }

  await prisma.user.update({
    where: { clerkId: data.id },
    data: updateData,
  });
}

export async function POST(req: Request) {
  const signingSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!signingSecret) {
    console.error(`${LOG_PREFIX} CLERK_WEBHOOK_SECRET is not set`);
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  let evt: Awaited<ReturnType<typeof verifyWebhook>>;
  try {
    evt = await verifyWebhook(req, { signingSecret });
  } catch (verifyErr) {
    logUnknownError("verifyWebhook failed", verifyErr);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.log(`${LOG_PREFIX} event received`, { type: evt.type, object: evt.object });

  try {
    switch (evt.type) {
      case "user.created": {
        const data = evt.data as ClerkUserPayload;
        await upsertUserFromClerk(data);
        break;
      }
      case "user.updated": {
        const data = evt.data as ClerkUserPayload;
        await syncUserFromClerk(data);
        break;
      }
      case "user.deleted": {
        const data = evt.data as ClerkUserPayload;
        await deleteUserDataByClerkId(data.id);
        break;
      }
      default:
        console.log(`${LOG_PREFIX} ignored event type`, { type: evt.type });
    }
  } catch (err) {
    logUnknownError(`handler failed for ${evt.type}`, err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
