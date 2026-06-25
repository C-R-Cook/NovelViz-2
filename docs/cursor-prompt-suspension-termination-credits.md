# Cursor prompt: verify and fix suspension vs. termination credit handling

---

## Context

The draft Terms of Service now promises a specific behavior:

- **Suspension** (an account flagged or under review, including pending an appeal) preserves the user's unused credit balance and subscription status. If the suspension is lifted, access and everything else is simply restored, nothing needed to be specially protected because nothing was touched.
- **Permanent termination** (an upheld appeal outcome, or a violation severe enough to skip suspension entirely) forfeits any unused credit balance, no refund.
- **Voluntary account deletion** forfeits unused credits the same way, since deletion wipes the account entirely per the Privacy Policy.

This prompt has two phases. Do not skip Phase 1, the ToS wording was written assuming a clean distinction between "suspended" and "permanently terminated" exists in the system, and that needs to be confirmed before Phase 2 touches anything.

---

## Phase 1: Investigate and report

Before changing anything, answer these questions by reading the actual code and schema (`prisma/schema.prisma`, the moderation system implementation, `lib/credits.ts`, `lib/subscription.ts`):

1. **Does `User` (or any related table) currently have a field that distinguishes account states**, specifically: active, suspended/under review, and permanently terminated/banned? If so, what is it called and what are its possible values? If not, how does the "auto-suspend at 7 strikes" behavior described in the moderation system design actually get enforced today, is access blocked some other way (e.g. checked at request time from strike count directly, rather than a stored status field)?
2. **Is there a concept of "permanent termination" distinct from "suspension" anywhere today?** Or does the current system only support an indefinite suspended state with no separate terminal state? Many systems only have one boolean (banned: true/false) rather than a three-state model, if that's the case here, say so explicitly.
3. **How does `ModerationAppeal` currently resolve?** When an appeal is approved vs. denied, what actually changes on the user's record today? Does denial currently do anything beyond closing the appeal (i.e., does it currently trigger any termination or credit action, or does denial just leave the existing suspension in place indefinitely)?
4. **What happens to credit balance today** (the `SUM(CreditTransaction.amount)` balance) when a user is suspended or banned by any existing mechanism? Is it just left alone because nothing currently reads or modifies it based on moderation status, or is there already some interaction?
5. **What happens today on voluntary account deletion** (`POST` or server action that performs the SQL wipe described in the Privacy Policy)? Confirm whether `CreditTransaction` rows are deleted along with the rest of the user's data as part of that existing flow, or whether they're orphaned/retained. This should already match the ToS promise, but confirm rather than assume.
6. **Does the existing self-deletion flow check account status before running?** Specifically: could a currently-suspended or currently-terminated user call the normal self-deletion endpoint today and have it succeed, deleting their data and their Clerk identity along with it? This matters a lot, see Phase 2.6 below.
7. **Can a suspended user currently sign in at all?** If they can, what do they see, full app access, a generic error, or something else? Is there any user-facing appeal submission flow today (something the user themselves fills out), or is the appeal process entirely admin-initiated/handled outside the app (e.g. over email)?
8. **Does `ModerationLog` currently record enough detail per flagged incident to show a user their own strike history** (date, what content triggered it, and ideally which Acceptable Use Policy category it falls under), or does it currently just record that a flag happened without much per-incident detail? This determines how much the suspended-account page (Phase 2.5) can show about the specific incidents behind a suspension, as opposed to a generic message.

Summarize your findings in a short report before proceeding to Phase 2. If what you find is substantially different from the three-state model assumed above (for example, if there's no terminal "permanently banned" state at all today, only suspension), stop and summarize that clearly rather than forcing Phase 2's plan onto a structure that doesn't match. We'll decide together how to proceed if that's the case.

---

## Phase 2: Implement, if Phase 1 finds a gap

Assuming Phase 1 confirms the gap (most likely: no distinct "permanently terminated" state, and/or no credit-forfeiture logic tied to moderation outcomes), implement the following. Adjust naming to match existing conventions found during Phase 1 rather than introducing inconsistent new patterns.

### 2.1 Account status

Add whatever is missing to represent three states cleanly: active, suspended, and permanently terminated/banned. If a `UserStatus` enum doesn't already exist, add one (e.g. `active | suspended | terminated`) and a field on `User` to hold it, with a migration. Keep existing strike-count fields as the input signal, this new field is the derived state, not a replacement for strike tracking.

### 2.2 Credit forfeiture as an immutable ledger entry, not a mutation

Per the existing principle that credit balance is always derived from `SUM(CreditTransaction.amount)` and never stored as a mutable column: when an account moves to permanently terminated, write a new `CreditTransaction` row with a negative amount equal to the user's current balance at that moment, zeroing it out via the ledger rather than deleting or mutating anything. Add a new `CreditTransactionReason` enum value for this (e.g. `FORFEITED_TERMINATION`) alongside the existing `PURCHASE | SPEND_QUERY | SPEND_IMAGE | ADMIN_ADJUST` values, with a migration.

Do **not** write any compensating transaction when an account is merely suspended, suspension should leave the credit ledger completely untouched, that's the whole point of the distinction.

### 2.3 Wire it to moderation outcomes

- Auto-suspend at 7 strikes (existing behavior) should set the new status to `suspended`, not `terminated`. No credit transaction.
- `ModerationAppeal` approval should return status to `active`. No credit transaction (nothing was touched).
- `ModerationAppeal` denial should set status to `terminated` and trigger the forfeiture transaction from 2.2.
- Any existing or future zero-tolerance immediate-ban path (referenced in the Acceptable Use Policy for severe violations) should set status to `terminated` directly, skipping `suspended`, and also trigger forfeiture.

### 2.4 Access control, and what "blocked" actually means

Wherever the app currently checks for "is this account allowed to use the Service" (likely in `proxy.ts` middleware or a shared auth helper):

- A **suspended** user should still be able to sign in, but should be routed to a restricted status screen (account suspended, reason if you currently surface one, and a self-serve appeal form if one exists per Phase 1's findings) rather than the normal app. They should not reach Q&A, image generation, the gallery, the library, or any other normal feature.
- A **terminated** user attempting to sign in should see a final notice (account permanently terminated, no further action available, optionally a contact-support link) rather than the normal app, and rather than a generic or confusing error.
- Neither state should produce a broken or unexplained experience, the person should always understand which of the two states they're in and what, if anything, they can do about it.

### 2.5 Suspended and terminated status pages

Build the actual pages that 2.4 routes people to, these don't exist yet.

**Suspended page** (e.g. `/account/suspended`):

- Headline along the lines of "Your account is suspended" with a short explanation that an admin will review it shortly.
- **The main thing to show is the user's actual strike history, not an abstract policy summary.** If suspension was triggered by reaching the 7-strike threshold, list the flagged items that make up those strikes (e.g. date, and a brief description or category of each), so the person can see specifically what led here. Whether this is fully possible depends on Phase 1's answer to question 8:
  - If `ModerationLog` already tracks which Acceptable Use Policy category each flagged item violated, show that category alongside each entry.
  - If it doesn't track category per entry, show what you can (date, and whichever content reference is already stored, e.g. a link or excerpt identifier) without inventing a category that isn't actually recorded.
  - Either way, this is showing the person *their own* flag history, not a general tour of the Acceptable Use Policy. Don't substitute a generic list of all policy categories for this, that was the wrong read on my part earlier, only fall back to a general "you can review our Acceptable Use Policy" link if there's truly no per-incident detail stored at all to show.
- **An explanation form:** a plain text box where the user can optionally explain themselves, no required fields beyond the text itself. On submit:
  - Create a record of the submission (use the existing `ModerationAppeal` model if it has a field for free-text user input, or add one if it doesn't, check Phase 1 findings on this model's current shape before deciding).
  - Send an admin email via the existing `lib/admin-email.ts` (`sendAdminEmail`), adding a new `AdminEmailCategory` (e.g. `ACCOUNT-APPEAL`) consistent with the existing categories (`CONTACT`, `BOOK-REQUEST`, etc.). Include the user's account identifier, the strike/flag history relevant to the suspension, and their submitted text in the body.
  - After successful submission, show a confirmation ("Your information has been submitted, we'll review your account shortly") and don't allow repeated resubmission, once is enough, prevents spam back to the admin inbox. If they want to add more information later, a simple "contact us" pointer is enough, doesn't need a second form.

**Terminated page** (e.g. `/account/terminated`):

- A final notice: "Your account has been permanently terminated for violating our Terms of Service or Acceptable Use Policy. This decision is final." with an optional contact-support link, but no explanation form. This is intentional, not an oversight, anyone reaching this state either already had their appeal heard and denied at the suspended stage, or violated something severe enough to skip suspension entirely. Don't build a second appeal path here, it would contradict what the Terms of Service already says about termination being final.

### 2.6 Admin UI

If the admin moderation queue or per-user admin page currently shows account status, surface the new three-state value there clearly (not just a strike count), so an admin reviewing an appeal can see at a glance whether an account is currently suspended (reversible) or already terminated (final). This is a nice-to-have if it's a small addition given what's already there; don't build new admin UI from scratch if it's a large lift, flag it as a follow-up instead.

### 2.7 Termination must not delete data, and self-deletion must not bypass termination

This is important and easy to get backwards by analogy with the existing self-deletion feature, so call it out explicitly:

- **Permanent termination never deletes the `User` row, the Clerk identity, or any other account data.** Only the status field changes and the credit ledger gets the forfeiture transaction from 2.2. The entire point of retaining the record is (a) accurate moderation history and (b) preventing the same email from being used to register a fresh account and evade the ban, since Clerk itself is what blocks duplicate-email signups, but only while the original Clerk identity still exists. Deleting it on termination would silently undo the ban.
- **The existing voluntary self-deletion flow must check account status and refuse to run for `suspended` or `terminated` accounts.** Without this check, a user could delete their own account immediately after being flagged or banned, which would both erase the moderation record and free up their email for a fresh, unbanned signup, defeating the entire purpose of this section's first point. Return a clear error directing them to contact support instead of silently failing or partially deleting.

---

## Testing checklist

1. Strike a test account to 7, confirm status becomes `suspended` and credit balance is unchanged.
2. Submit and approve an appeal on that account, confirm status returns to `active`, credit balance still unchanged throughout.
3. Submit and deny an appeal on a different test account, confirm status becomes `terminated` and a `FORFEITED_TERMINATION` transaction zeroes the balance.
4. Trigger (or simulate) a zero-tolerance immediate ban, confirm it goes straight to `terminated` with forfeiture, without ever passing through `suspended`.
5. Delete a test account with a nonzero credit balance via the normal self-deletion flow, confirm all `CreditTransaction` rows for that user are gone along with the rest of the account data, consistent with the Privacy Policy's "we delete it immediately" description.
6. Confirm a `suspended` user can sign in and lands on the restricted status/appeal screen, not the normal app, and not a broken page.
7. Confirm a `terminated` user can sign in and sees the final termination notice, not the normal app.
8. Confirm an `active` user with a prior suspension in their history is not blocked and sees the normal app.
9. Attempt self-deletion on a `suspended` test account, confirm it's refused with a clear error rather than succeeding.
10. Attempt self-deletion on a `terminated` test account, confirm it's refused the same way.
11. After a termination, confirm the `User` row and the Clerk identity both still exist, and that signing up again with the same email at `/register` is rejected by Clerk as an existing account, not allowed to proceed as a fresh signup.
