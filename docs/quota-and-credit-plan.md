NovelViz — Quota System Audit & Implementation Spec
I need you to audit the existing quota/usage system and implement it correctly end-to-end. Below is a full spec of how it should work. Where existing code already handles something correctly, leave it alone. Where it's missing or wrong, implement it properly.

Overview
NovelViz has three reader subscription tiers: Free, Standard, and Advanced. Each tier has a monthly allowance of image generations and Q&A queries. These limits must be enforced in real-time — users cannot exceed their quota, and we do not operate on an honor system.

Tier Limits
Limits must be stored in the database and driven by a config the admin can edit. There must be no hardcoded limit values anywhere in the codebase — not in API routes, not in frontend components, not in constants files. The single source of truth is the database config, and all limit checks must read from it.
The approximate starting values (subject to admin adjustment) are whatever is currently shown on the plan picker page. Treat those as placeholders — the important thing is that they're dynamic, not what the numbers actually are right now.

How Limits Are Enforced
Before processing any image generation request (POST /api/imagine) or Q&A request (POST /api/query), the API must:

Identify the user's current subscription tier
Look up the limit for that tier from the dynamic config
Count how many of that action the user has performed in their current billing period
If the count is at or above the limit, reject the request with a structured error response (not a generic 500) that tells the client exactly why it was rejected — specifically that the quota is exhausted - this could be handled by a friendly pop up showing them the upgrade teit and credit purchase options.

The billing period is monthly, anchored to the user's subscription start date (not the calendar month). Stripe manages this date via the subscription object. The period start for quota counting purposes should come from the current Stripe billing period, not be calculated independently. With that in mind, we should also audit the readyness to integrate stripe in to the site.

Frontend Enforcement Response
When a quota-exhausted error is returned from the API, the frontend must intercept it and show a modal/popup that:

Tells the user they've used their full monthly allowance for that action
Shows their current tier and limit
Offers a clear upgrade CTA that takes them to the plan selection page

This should feel like a helpful prompt, not a hard error. Do not show a generic error toast for quota exhaustion — it must be its own distinct UI treatment.

Upgrade Behaviour (Mid-Cycle)
When a user upgrades their tier mid-cycle:

Stripe handles the prorated charge automatically — we do not need to calculate this
On receiving the Stripe customer.subscription.updated webhook event where the tier has increased, we reset the user's usage counters (both image generations and Q&A queries) to zero for the new billing period
This reset is a deliberate promotional gesture — upgrading users get a fresh full allowance immediately rather than only the remainder
This logic lives in the Stripe webhook handler

When a user downgrades:

The downgrade is scheduled for the next billing cycle (handled via Stripe's proration_behavior setting) — do not apply it immediately
No counter reset on downgrade
The user retains their current tier's limit until the cycle ends

This asymmetry (immediate reset on upgrade, deferred on downgrade) closes the obvious abuse loop where someone could upgrade and downgrade repeatedly to farm quota resets.

Can you add a place holder FAQ in the FAQ page to explain this. At this time the FAQ page is all just there to remind me to awnser that question correctly, none of them are fully corretly awnsered yet.

Stats We Need to Track
The quota system must support the following reporting needs. If the underlying data isn't being stored correctly to support these, fix the storage first:

Per-user monthly usage — how many images and how many Q&A queries a user has consumed in their current billing period, expressed both as a raw count and as a percentage of their limit. Admins need to be able to see this.
Per-user all-time totals — total images generated and total questions asked, across all time, regardless of billing period. Separate from the monthly quota counter.
Per-book totals — total images generated and total Q&A queries for each book, across all users. This is a partner-facing stat that shows how their book is performing on the platform.

These don't necessarily require new database columns if the data can be derived from existing records — but the queries must be correct and efficient enough to use in the admin stats page and partner stats page.

There are edge cases where the AI will fail to return a response to a user request, we need to handle this, failures should not be deducted from user quotas. We also need to check what actually happens from a user perspective when this happens, we need to ensure it is user friendly and not an ugly generic error message, more like an opps, something went wrong, I've reported it to the stite admin for you, this will not be deducted from your allowance / credits. We also need to ensure that there is a way for this to be automatically reported to admins so that we can monitor failures for things that could be part of a bigger issue.

Admin Controls
Admins must be able to:

View and edit the per-tier limits (images and Q&A) globally from the admin panel — changes take effect immediately for all users on that tier
Override limits for a specific user (grant more than their tier allows, or restrict them below it) — a per-user override takes precedence over the global tier limit and can be either for the remainder of their cycle or permanent.
View any user's current usage for the billing period alongside their limit. The more I talk about this I feel like I need a manage user page, where I can select any user and it opens up a whole bunch of options for me, shows me stats about them, their images & questions, if they are a partner it should include their books.

Remember that tier is different from user type. Tiers control their ability and restrictions to use our services. User type tells us if they are an andmin, partner, or reader. Remember that an admin is also a partner and a reader, a partner is also a reader, and a reader is just a reader.


What to Audit
Please check the following and report findings before making changes:

Is there an existing quota enforcement check in /api/imagine and /api/query? If so, how does it work and is it correct?
Where are tier limits currently stored? Are they hardcoded or dynamic?
Is there a UserGrant or similar table that handles per-user overrides? Does it cover quota limits or only feature access?
How is the billing period currently tracked? Is it tied to Stripe or managed independently?
Is the Stripe webhook handler capturing subscription upgrade/downgrade events? What does it do with them?
What usage data is currently being stored that could support the three reporting requirements above?

Credit Packs (Persistent Overage Allowance)
Users will be able to purchase one-time credit packs as a top-up on top of their monthly subscription allowance. Credits are distinct from the monthly quota — they never expire, do not reset at billing cycle end, and are consumed only after the monthly allowance is exhausted.

How Credits Work
The consumption order is always:

Monthly quota first (subscription allowance for the current billing period)
Credit balance second (only drawn from once monthly quota reaches zero)

This means a user who buys credits mid-month won't see them touched until their quota runs out. Credits persist across billing cycles, tier changes, and indefinitely until used.

Pricing & Credit Packs
Credit pack pricing is tiered by subscription level — Advanced subscribers get a lower per-credit price than Standard, who get a lower price than Free. This is a deliberate incentive: upgrading your subscription makes your credits cheaper, adding compounding value to higher tiers.
Exact pack sizes and prices are not finalised. They must be configurable by an admin and must not be hardcoded. The frontend plan/upgrade pages must read pack pricing dynamically from the same config system as tier limits.
Whether to offer credit pack purchases to Free tier users is undecided. The system must support it as a toggle — a per-tier setting that controls whether the purchase UI is shown and whether purchases are permitted. Do not assume Free users can or cannot buy credits; make it configurable.

What Credits Can Be Spent On
Credits can be spent on image generations and Q&A queries, at a defined cost per action. These costs should also be admin-configurable and not hardcoded. It's reasonable to have images cost more credits than queries, reflecting the actual cost difference, but the exact ratio is TBD.

Upgrade Interaction
When a user upgrades their subscription tier, their credit balance is unaffected. The quota reset promotion (described above) applies only to the monthly quota counter — it does not touch credits. Credits the user purchased before upgrading remain in their balance and continue to be consumed after the new tier's monthly quota is exhausted.

Stats & Reporting
The existing reporting requirements extend to credits:

Per-user current credit balance must be visible to admins
Credit expenditure should be tracked per-action (image vs query) and per-book, consistent with the quota stats above
Credit pack purchase history should be retained for support and abuse detection purposes


What to Audit (additions)
Add these to the audit checklist:

Is there any existing credit or token purchase system in place? Check the schema for any balance, credit, or token fields on the User model or a related table.
Is there a CreditPack or similar table? If not, one will be needed with at minimum: pack size, price, per-tier price overrides, and an active/inactive flag.
Is there a CreditTransaction or ledger table? Credits should be tracked as a ledger (purchases add, expenditure subtracts) rather than a single mutable balance field, for auditability.
Does the Stripe webhook handler have any stub for one-time payment (as opposed to subscription) events? Credit pack purchases will be one-time Stripe Checkout sessions, not subscription line items.


The ledger approach for credits is worth insisting on even if it feels like overkill early. A single creditBalance integer on the User row is tempting but creates support headaches — if something goes wrong you have no audit trail. A simple CreditTransaction table with userId, amount (positive for purchase, negative for spend), reason, bookId (nullable), and createdAt gives you the balance (sum of all transactions), full history, and per-book spend breakdowns for free, all from one table.

While we are at it we should maybe add a purchase history section to all users in their reader acount.
Admin acounts should always have unlimited generation credits, and will not have stripe acounts linked to the site, so should not error in any way as a result.

In the future we will be adding a layer of moderation to filter out hateful / offencice content. our AI's hav their own filter, and may return fails, but we will try to filter these before we send them to avoide API costs. None of these failures should count towards limits, but should direct them to an FAQ about possible reasons requests fail. I do not want to impliment this part yet, as it will also tounch on another update relating to copyright protection, but we should be aware that things like this are coming and will have dorect interactiosn with what we are doing here.

I think that covers everything, but if you notice something you feel I may have missed please report it to me. Report your findings as a structured list, then propose a migration plan before touching any code.