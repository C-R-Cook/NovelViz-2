# Email Change Feature

## Status (implemented)

- **UI:** [`components/account/email-change-section.tsx`](../components/account/email-change-section.tsx) — inline 3-state flow on Profile (account page + dashboard Account tab).
- **Webhook:** [`app/api/webhooks/clerk/route.ts`](../app/api/webhooks/clerk/route.ts) — `user.updated` syncs primary email + name via `syncUserFromClerk()`; skips email overwrite when payload has no primary address.
- **Schema:** `User.email` is a non-unique `String` (no migration required).
- **Dev impersonation:** Change email UI is visible but disabled unless signed in via Clerk (`useAuth().isSignedIn`).

## Goal

Allow users to change their email address from the `/account` page. The flow uses Clerk's frontend SDK to add and verify the new email, then promotes it to primary and removes the old one. A `user.updated` webhook keeps the NovelViz `User.email` column in sync.

This is a two-part implementation:
1. **Account page UI** — inline email change form with verification step
2. **Webhook handler** — handle `user.updated` events in the existing Clerk webhook route

---

## Part 1 — Account page email section

### File to read first
Open `app/(reader)/(app)/account/` and read the existing account page and any client components in it. The email field currently shows a read-only input with helper text "Email is managed by Clerk and cannot be changed here". We are replacing that with a self-contained inline flow.

### New component: `components/account/email-change-section.tsx`

Create a `"use client"` component. It must use `@clerk/nextjs` frontend SDK — specifically `useUser()`.

The component has three visual states, all rendered inline in place of the current read-only email field:

**State 1 — Default (no change in progress)**
- Read-only input showing current primary email
- A small "Change email" link/button beneath it
- Clicking "Change email" transitions to State 2

**State 2 — Enter new email**
- Text input for the new email address (type="email", autofocused)
- "Send verification code" button
- "Cancel" link that returns to State 1
- On submit:
  - Call `user.createEmailAddress({ email: newEmail })`
  - This triggers Clerk to send a verification code to the new address
  - Transition to State 3, passing the returned `emailAddressResource` object
- Show inline error if the call fails (e.g. email already in use)

**State 3 — Enter verification code**
- Display message: "We sent a 6-digit code to {newEmail}"
- 6-digit code input (type="text", inputMode="numeric", maxLength=6, autofocused)
- "Verify" button
- "Use a different email" link that returns to State 2
- On submit:
  - Call `emailAddressResource.attemptVerification({ code })`
  - On success:
    - Call `user.update({ primaryEmailAddressId: emailAddressResource.id })`
    - Then find and destroy the old email address: find the email in `user.emailAddresses` where `id !== emailAddressResource.id` and call `.destroy()` on it
    - Show a brief success message ("Email updated successfully") then return to State 1 showing the new email
  - Show inline error if the code is wrong or expired

### Styling rules
- Match the visual style of other form sections on the account page exactly — same input styles, same button styles, same spacing
- Use only CSS custom property tokens (`var(--accent)`, `var(--foreground)`, etc.) — no hardcoded colours
- Error messages in `text-red-500` or whatever error colour is already used on the page
- The entire flow is inline — no modals, no separate pages

### Wire into account page
In the account page, find the email section and replace the read-only email display + helper text with `<EmailChangeSection />`.

---

## Part 2 — Webhook handler for `user.updated`

### File: `app/api/webhooks/clerk/route.ts`

**Implemented.** The `user.updated` case calls `syncUserFromClerk()`, which updates `email` (when a primary address is present) and `name`. Empty/missing primary email in the payload skips the email field (logs a warning) so test fixtures do not wipe `User.email`.

Subscribe to `user.updated` on the production webhook endpoint (`https://www.novelviz.com/api/webhooks/clerk`).

<details>
<summary>Original spec (reference)</summary>

```ts
case "user.updated": {
  const { id, email_addresses, primary_email_address_id } = evt.data as {
    id: string
    email_addresses: Array<{ id: string; email_address: string }>
    primary_email_address_id: string
  }

  const primaryEmail = email_addresses.find(
    (e) => e.id === primary_email_address_id
  )

  if (!primaryEmail) {
    console.error("[webhook] user.updated: no primary email found", id)
    return NextResponse.json({ error: "no primary email" }, { status: 400 })
  }

  await prisma.user.update({
    where: { clerkId: id },
    data: { email: primaryEmail.email_address },
  })

  console.log(`[webhook] user.updated: email synced for ${id}`)
  return NextResponse.json({ received: true })
}
```

Use the existing `prisma` import already in the file. Do not change any other cases. Return 200 for all success paths so Clerk does not retry unnecessarily.

</details>

---

## What NOT to do
- Do not install any new packages — `@clerk/nextjs` is already installed
- Do not create any new API routes — the Clerk SDK handles email management client-side directly
- Do not add any DB migrations — `User.email` already exists
- Do not use `<UserProfile />` from Clerk — we want a custom inline flow that matches our UI
- Do not use `user.primaryEmailAddress?.emailAddress` for the displayed current email — read it from `user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress` for correctness

---

## Acceptance criteria
- User can initiate an email change, receive a verification code, enter it, and have their email updated in both Clerk and the NovelViz DB
- The old email address is removed from Clerk after the new one is verified and promoted
- If the user abandons mid-flow (e.g. navigates away), no orphaned unverified email is permanently attached — Clerk handles cleanup automatically
- The `user.updated` webhook handler returns 200 on success and does not break existing `user.created` / `user.deleted` handling
- All UI states are consistent with the rest of the account page visually
