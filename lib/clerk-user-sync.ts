import { createClerkClient } from "@clerk/backend";

const DEV_CLERK_PREFIX = "user_dev_clerk_";

function clerkClient() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return null;
  return createClerkClient({ secretKey });
}

/** Push the NovelViz gallery username to Clerk (creation, register, account settings). */
export async function syncClerkUsername(clerkId: string, username: string): Promise<void> {
  if (clerkId.startsWith(DEV_CLERK_PREFIX)) return;

  const clerk = clerkClient();
  if (!clerk) return;

  await clerk.users.updateUser(clerkId, { username });
}

/** Clear Clerk username when the NovelViz username is removed (rare — account settings). */
export async function clearClerkUsername(clerkId: string): Promise<void> {
  if (clerkId.startsWith(DEV_CLERK_PREFIX)) return;

  const clerk = clerkClient();
  if (!clerk) return;

  await clerk.users.updateUser(clerkId, { username: "" });
}
