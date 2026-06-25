# NovelViz Privacy Policy (DRAFT)

**Last updated:** [DATE]
**Effective date:** [DATE]

> This is a working draft, not a finished legal document. It is written to accurately reflect NovelViz's actual data flows and vendors as of June 2026. It has not been reviewed by a lawyer. Before publishing, get it reviewed, especially the Children's Privacy section, which is flagged as an open item below.

---

## 1. Who We Are

NovelViz ("NovelViz," "we," "us," "our") operates novelviz.com (the "Service"), a spoiler-safe AI reading companion that lets readers ask questions about books they're reading and generate illustrative images, with all AI responses limited to content from chapters they've already reached.

NovelViz is built and run by a single founder, so you may occasionally see "I" used in places alongside "we." Both refer to the same thing: NovelViz.

NovelViz is based in Vancouver, British Columbia, Canada. This policy applies to all visitors, registered users, and partners who use the Service, regardless of location.

If you have questions about this policy or how we handle your data, reach out via our [contact page](/contact) or email hello@novelviz.com.

---

## 2. Information We Collect

### 2.1 Information you give us directly

- **Account information.** When you sign up, our authentication provider (Clerk) collects your email address and name. You choose a public username inside NovelViz.
- **Profile information.** Your username and at least one genre preference are needed to complete onboarding and power basic personalization. Gender, age range, and country are optional and only collected if you choose to provide them, to further personalize recommendations and, for partners, inform aggregate audience targeting (see Section 4.3).
- **Your library.** Which books you've added, your reading progress (current chapter), and your settings, such as spoiler protection preferences.
- **Questions and prompts.** The text of questions you ask about books, and the prompts you submit to generate images.
- **Generated content.** AI-generated answers to your questions, and AI-generated images, are stored against your account so you can revisit them.
- **Comments.** Any comments you post on gallery images.
- **Communications.** Anything you send us via our contact form, book request form, or partner application.
- **Payment information.** If you subscribe to a paid tier or purchase credits, payment is collected directly by Stripe through their secure checkout. Your card details go straight to Stripe and never pass through our servers. We receive only confirmation that a payment succeeded, your subscription tier, and billing status.

### 2.2 Information collected automatically

- **Usage data.** Which features you use, how many questions you ask, how many images you generate, and when, for the purpose of enforcing plan limits and improving the product.
- **Technical and log data.** IP address, browser type, device type, and similar technical information, collected automatically by our hosting provider (Vercel) as part of standard web server operation.
- **Cookies.** See Section 9.

### 2.3 Information we do not collect

We do not require you to upload or paste full book text into NovelViz. Book content is sourced from public domain catalogues (such as Project Gutenberg) or supplied directly by publisher and independent author partners who choose to list their work on NovelViz. We do not collect biometric data, precise geolocation, or government ID numbers.

---

## 3. How We Use Your Information

We use the information above to:

- Provide the Service: answer your questions about books you're reading, generate images, track your library and progress
- Enforce chapter-based spoiler protection (this is the core function of the product, see Section 5)
- Enforce plan limits (free, standard, premium quotas) and process payments
- Send you operational notifications (e.g. quota reached, comment moderation outcomes) via in-app notifications
- Send administrative emails to our own team when you submit a contact form, book request, or partner application
- If you opt in, send you occasional email updates such as a monthly newsletter to keep you posted on new books, features, or community highlights. You can unsubscribe at any time, and we only send this with your consent.
- Improve the product, debug issues, and maintain security
- For partners: provide aggregated, non-identifying engagement statistics about how readers interact with their books (see Section 4.3)
- Comply with legal obligations

We do not sell your personal information to third parties, and we do not use your reading history or questions to train AI models on behalf of third parties.

---

## 4. How We Share Your Information

We share information with the service providers ("subprocessors") below, each of which processes data only to provide their specific function to us, under their own data processing and security terms.

| Provider | What they receive | Why |
|---|---|---|
| Clerk | Email, name, authentication credentials | Account creation and login |
| Neon (PostgreSQL) | All application data (your profile, library, queries, generated content) | Database hosting |
| Vercel | IP address, request logs, all data in transit | Application hosting |
| Cloudinary | Generated images, book cover images | Image storage and delivery |
| OpenAI | Text of your questions and image prompts (not your name or email) | Generates embeddings used for spoiler-safe content retrieval |
| Anthropic | Text of your questions, relevant book excerpts (limited to chapters you've reached), image prompts | Generates Q&A answers and enriches image generation prompts |
| fal.ai | Image generation prompts | Generates the actual AI images you request |
| Stripe | Name and email for the checkout session; payment details are collected and held by Stripe directly, never by us | Subscription billing and credit purchases |
| Resend | Contact form and request submissions, sent to our internal team only | Internal admin email alerts |
| Loops (planned, not yet active) | Email address, name | Monthly newsletter and other updates, sent only to users who opt in |

### 4.1 AI processing, what this actually means

When you ask a question or generate an image, the relevant excerpt of the book (limited only to chapters you've already reached) and your question or prompt text are sent to OpenAI (for retrieval), and to Anthropic and fal.ai (to generate the response or image). These providers process this data to return a result to us. We do not have visibility into, or control over, their internal retention practices beyond what's stated in their own policies (for example, fal.ai's policy is at fal.ai/legal/privacy-policy). We do not permit these providers to use your data to train their general-purpose models, where their commercial or API terms allow us to opt out, and we use their business or API tiers rather than free consumer products for this reason.

### 4.2 Legal disclosures

We may disclose information if required by law, court order, or governmental request, or to protect the rights, property, or safety of NovelViz, our users, or others.

### 4.3 Publisher and partner data

Partners (publishers and authors who upload books) receive only aggregated, non-identifying statistics about how readers engage with their books, such as reader counts, chapter engagement heatmaps, and anonymized demographic breakdowns. Partners do not receive your name, email, or individual reading activity.

### 4.4 Business transfers

If NovelViz is acquired, merges, or sells assets, your information may be transferred as part of that transaction, subject to the commitments in this policy.

---

## 5. Why We Collect Reading Progress (Important Context)

NovelViz's core design principle is that AI features only ever draw on chapters you've already read. We store your current chapter position for each book specifically so that we can prevent the AI from spoiling content you haven't reached yet, not for any other purpose. This data point exists for your protection, not for profiling.

---

## 6. Data Retention

When you delete your account, we delete your personal data immediately: your account record is removed directly from our database, and your authentication record is removed from Clerk. This is not a scheduled or batch process; it happens at the time of deletion.

[Open item: what happens to images you generated, questions you asked, and public comments you made, after your account itself is deleted, is still being finalized. Some of this content may be visible to or interacted with by other users (likes, comments), which affects how cleanly it can be removed versus de-identified. This section will be completed once that's decided. See internal notes.]

We also retain, regardless of account deletion:

- Information we're required to keep for legal, tax, or fraud-prevention purposes
- Aggregated, de-identified usage statistics that no longer identify you
- Moderation records (strikes, appeals) needed to maintain platform integrity

**If your account has been suspended or permanently terminated for violating our Terms of Service or Acceptable Use Policy, you cannot delete your account, and we do not delete your account data, even though this is otherwise something we offer.** We retain this information to maintain accurate enforcement records and to prevent the same person from creating a new account to bypass a suspension or termination. This is a standard, recognized exception to data deletion rights under PIPEDA, GDPR, and similar frameworks, retaining records for fraud prevention and to enforce our own terms.

---

## 7. Your Privacy Rights

Regardless of where you live, you can always:

- Access the personal data we hold about you
- Correct inaccurate data
- Delete your account and associated personal data (accounts suspended or permanently terminated for violating our Terms of Service or Acceptable Use Policy are an exception, see Section 6)
- Export your data in a portable format
- Opt out of any marketing email, including the monthly newsletter

To exercise any of these rights, reach out via our [contact page](/contact) or email hello@novelviz.com. We will respond within a reasonable time, generally 30 days.

### 7.1 If you are a California resident

You have the right to know what categories of personal information we collect and for what purpose, to request deletion, and to non-discrimination for exercising your rights. We do not sell or "share" (as defined under California law) your personal information for cross-context behavioral advertising.

### 7.2 If you are in a US state with a comprehensive privacy law (California, Colorado, Connecticut, Virginia, and a growing list of others)

You may have rights to access, correct, delete, and port your data, and to opt out of targeted advertising, sale of data, or certain profiling. We do not engage in the sale of personal data or targeted third-party advertising. Where applicable, we honor Global Privacy Control (GPC) signals as an opt-out mechanism.

### 7.3 If you are in the European Economic Area or United Kingdom

Our lawful bases for processing are: performance of a contract (providing the Service you signed up for), legitimate interests (product improvement, security), and consent (where applicable, such as the optional newsletter). You have rights under GDPR including access, rectification, erasure, restriction, portability, and objection, and the right to lodge a complaint with your local data protection authority.

### 7.4 If you are in Canada

We process your personal information in accordance with PIPEDA. You have the right to access and request correction of your personal information.

---

## 8. Adult-Only Service

NovelViz is intended for users aged 18 and over. It is not directed at, or designed for, use by minors, and we do not knowingly collect personal information from anyone under 18.

We ask users to accurately represent their age when they sign up, but we do not independently verify age or identity. If we become aware that we've collected personal information from someone under 18, we will delete that account and the associated data.

We are not currently set up to support classroom or institutional use involving minors. We may revisit this in the future, but it isn't supported today.

---

## 9. Cookies, Similar Technologies, and Third-Party Links

We use cookies and similar technologies for:

- Essential functions, such as keeping you signed in (via Clerk), and remembering your theme preference and onboarding state
- Basic, privacy-respecting analytics to understand aggregate usage patterns and improve the product

We do not currently use third-party advertising cookies or cross-site tracking. Because we don't currently use non-essential tracking cookies, we don't display a cookie consent banner; if that changes (for example, if we add third-party analytics or advertising tools), we will add a consent mechanism at that point.

**Affiliate links.** Some pages on NovelViz may include affiliate links to retailers such as Amazon, where we may earn a small commission if you make a purchase after clicking through. Clicking an affiliate link takes you to a third-party site, which has its own privacy practices and may set its own cookies or tracking, entirely outside of our control. We encourage you to review the privacy policy of any third-party site you visit through these links.

---

## 10. Data Security

We use industry-standard safeguards, including encrypted connections (HTTPS), access controls, and reputable infrastructure providers (Vercel, Neon, Clerk, Cloudinary) who maintain their own security certifications. No system is perfectly secure, and we cannot guarantee absolute security of your information.

---

## 11. International Data Transfers

NovelViz and its service providers operate infrastructure in multiple countries, including the United States. By using the Service, you understand that your information may be processed outside of your country of residence, including in countries that may have different data protection laws than your own. We take steps to ensure appropriate safeguards are in place with our providers.

---

## 12. Changes to This Policy

We may update this policy from time to time. If we make material changes, we will notify you via the Service or by email, and update the "Last updated" date above.

---

## 13. Contact Us

Questions about this policy or your data: reach out via our [contact page](/contact) or email hello@novelviz.com.

NovelViz
Vancouver, British Columbia, Canada

---

## Internal notes, NOT for publication (delete before publishing)

Open items to resolve before this goes live:

1. Minimum age is now 18, not 13. This also means the "Under 18" option in the Age range dropdown (onboarding) needs to come out, since it lets a true minor casually hand you evidence of their age after signup, the opposite of what Section 8 needs. School use for minors is paused, not abandoned; when that conversation picks back up, it's the point to design a real institutional arrangement (and a proper 13-17 tier with its own protections, if you ever want that cohort) rather than let it happen through an ordinary signup.
2. Product note, not policy text: make sure signup actually includes a simple age affirmation (e.g. "I confirm I am 18 or older"), even though it's self-reported and unverified. It won't stop anyone determined to lie, but it's what makes "we ask users to accurately represent their age" in Section 8 true, and it's the standard trigger point regulators look for.
3. Section 6: decide together what happens to a deleted user's generated images, questions, and public comments. Options range from full deletion regardless of other users' interactions, to de-identifying the content while leaving it visible (e.g. removing the username/attribution but keeping the image in the gallery). This affects both the policy wording and possibly the deletion logic itself.
4. Confirm current user counts and revenue against the roughly 20-state US privacy law thresholds (typically 25,000 to 100,000+ residents, or revenue-based) before asserting non-applicability anywhere. Current scale is well under, but recheck every 6 to 12 months or at major growth milestones.
5. Once Loops is live and the newsletter actually sends, note that as a Canadian business sending commercial email, CASL (Canada's Anti-Spam Legislation) applies: you need consent, clear sender identification, and a working unsubscribe link in every send. Worth a quick read of CASL's basic requirements before the first newsletter goes out, since it's a different consent standard than US CAN-SPAM.
6. Once Stripe billing is actually wired up, confirm the description in Section 4 still matches the real checkout flow.
7. If any analytics or ad tooling is added later, even privacy-friendly analytics, Section 9 needs updating, and that's also the point where a cookie consent banner stops being optional in the EU/UK.
8. Have an actual lawyer sanity-check Sections 7 and 8 before this goes live, particularly Section 8 given the minors angle, even though it's now a much lighter touch at 18+. While reviewing, also have them glance at the new suspension/termination carve-out in Section 6/7, it's standard practice but worth a one-line confirmation rather than assuming.
