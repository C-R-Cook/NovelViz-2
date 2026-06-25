/**
 * Entry point for content moderation to record strikes and trigger auto-suspend.
 * Call `recordContentStrike` after confirming a policy violation on user content.
 */
export {
  checkStrikeThresholdAndSuspend,
  recordModerationLog,
  STRIKE_SUSPEND_THRESHOLD,
} from "@/lib/account-enforcement";

export type { ModerationLogInput } from "@/lib/account-enforcement";

import {
  checkStrikeThresholdAndSuspend,
  recordModerationLog,
  type ModerationLogInput,
} from "@/lib/account-enforcement";
import { ModerationLogSource } from "@db";

/** Record a strike from automated moderation and auto-suspend at threshold. */
export async function recordContentStrike(
  subjectUserId: string,
  entry: Omit<ModerationLogInput, "source"> & { source?: ModerationLogSource },
): Promise<void> {
  await recordModerationLog(subjectUserId, {
    ...entry,
    source: entry.source ?? ModerationLogSource.auto,
  });
  await checkStrikeThresholdAndSuspend(subjectUserId);
}

/** Record a user-driven content flag as a strike on the content owner. */
export async function recordUserFlagStrike(
  subjectUserId: string,
  flaggedByUserId: string,
  entry: Omit<ModerationLogInput, "source" | "flaggedByUserId">,
): Promise<void> {
  await recordModerationLog(subjectUserId, {
    ...entry,
    source: ModerationLogSource.user_flag,
    flaggedByUserId,
  });
  await checkStrikeThresholdAndSuspend(subjectUserId);
}
