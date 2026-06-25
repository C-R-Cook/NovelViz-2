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

### 2.4 Access control

Wherever the app currently checks for "is this account allowed to use the Service" (likely in `proxy.ts` middleware or a shared auth helper), make sure both `suspended` and `terminated` block access, the distinction only matters for credit handling and appeal eligibility, not for whether they can currently log in and use NovelViz.

### 2.5 Admin UI

If the admin moderation queue or per-user admin page currently shows account status, surface the new three-state value there clearly (not just a strike count), so an admin reviewing an appeal can see at a glance whether an account is currently suspended (reversible) or already terminated (final). This is a nice-to-have if it's a small addition given what's already there; don't build new admin UI from scratch if it's a large lift, flag it as a follow-up instead.

---

## Testing checklist

1. Strike a test account to 7, confirm status becomes `suspended` and credit balance is unchanged.
2. Submit and approve an appeal on that account, confirm status returns to `active`, credit balance still unchanged throughout.
3. Submit and deny an appeal on a different test account, confirm status becomes `terminated` and a `FORFEITED_TERMINATION` transaction zeroes the balance.
4. Trigger (or simulate) a zero-tolerance immediate ban, confirm it goes straight to `terminated` with forfeiture, without ever passing through `suspended`.
5. Delete a test account with a nonzero credit balance via the normal self-deletion flow, confirm all `CreditTransaction` rows for that user are gone along with the rest of the account data, consistent with the Privacy Policy's "we delete it immediately" description.
6. Confirm a `suspended` or `terminated` user is blocked from using the Service (existing access-control path), and that an `active` user with a prior suspension in their history is not blocked.
