import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | NovelViz",
  description: "How NovelViz collects, uses, and protects your personal data.",
};

const LAST_UPDATED = "June 25, 2026";
const EFFECTIVE_DATE = "June 25, 2026";

const h2 = "text-lg font-semibold tracking-tight text-text-primary sm:text-xl";
const h3 = "mt-6 text-base font-semibold tracking-tight text-text-primary";
const p = "mt-3 text-sm leading-relaxed text-text-muted sm:text-[15px]";
const ul = "mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-text-muted sm:text-[15px]";
const linkClass =
  "text-accent-text underline-offset-2 hover:text-text-primary hover:underline";
const strong = "font-medium text-text-primary";
const tableWrap =
  "mt-4 overflow-x-auto rounded-lg border border-border-subtle";
const tableClass = "w-full min-w-[640px] text-left text-sm text-text-muted";
const thClass =
  "border-b border-border-subtle bg-bg-surface/60 px-3 py-2 font-medium text-text-primary";
const tdClass = "border-b border-border-subtle px-3 py-2 align-top";

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 text-text-primary sm:px-6 sm:py-16">
      <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">Privacy Policy</h1>
      <p className="mt-2 text-sm text-text-secondary">Last updated: {LAST_UPDATED}</p>
      <p className="mt-1 text-sm text-text-secondary">Effective date: {EFFECTIVE_DATE}</p>

      <div className="mt-10 space-y-8">
        <section>
          <h2 className={h2}>1. Who We Are</h2>
          <p className={p}>
            NovelViz (&quot;NovelViz,&quot; &quot;we,&quot; &quot;us,&quot; &quot;our&quot;) operates novelviz.com
            (the &quot;Service&quot;), a spoiler-safe AI reading companion that lets readers ask questions about books
            they&apos;re reading and generate illustrative images, with all AI responses limited to content from
            chapters they&apos;ve already reached.
          </p>
          <p className={p}>
            NovelViz is built and run by a single founder, so you may occasionally see &quot;I&quot; used in places
            alongside &quot;we.&quot; Both refer to the same thing: NovelViz.
          </p>
          <p className={p}>
            NovelViz is based in Vancouver, British Columbia, Canada. This policy applies to all visitors, registered
            users, and partners who use the Service, regardless of location.
          </p>
          <p className={p}>
            If you have questions about this policy or how we handle your data, reach out via our{" "}
            <Link href="/contact" className={linkClass}>
              contact page
            </Link>{" "}
            or email{" "}
            <Link href="mailto:hello@novelviz.com" className={linkClass}>
              hello@novelviz.com
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className={h2}>2. Information We Collect</h2>

          <h3 className={h3}>2.1 Information you give us directly</h3>
          <ul className={ul}>
            <li>
              <span className={strong}>Account information.</span> When you sign up, our authentication provider
              (Clerk) collects your email address and name. You choose a public username inside NovelViz.
            </li>
            <li>
              <span className={strong}>Profile information.</span> Your username and at least one genre preference are
              needed to complete onboarding and power basic personalization. Gender, age range, and country are optional
              and only collected if you choose to provide them, to further personalize recommendations and, for
              partners, inform aggregate audience targeting (see Section 4.3).
            </li>
            <li>
              <span className={strong}>Your library.</span> Which books you&apos;ve added, your reading progress
              (current chapter), and your settings, such as spoiler protection preferences.
            </li>
            <li>
              <span className={strong}>Questions and prompts.</span> The text of questions you ask about books, and the
              prompts you submit to generate images.
            </li>
            <li>
              <span className={strong}>Generated content.</span> AI-generated answers to your questions, and
              AI-generated images, are stored against your account so you can revisit them.
            </li>
            <li>
              <span className={strong}>Comments.</span> Any comments you post on gallery images.
            </li>
            <li>
              <span className={strong}>Communications.</span> Anything you send us via our contact form, book request
              form, or partner application.
            </li>
            <li>
              <span className={strong}>Payment information.</span> If you subscribe to a paid tier or purchase credits,
              payment is collected directly by Stripe through their secure checkout. Your card details go straight to
              Stripe and never pass through our servers. We receive only confirmation that a payment succeeded, your
              subscription tier, and billing status.
            </li>
          </ul>

          <h3 className={h3}>2.2 Information collected automatically</h3>
          <ul className={ul}>
            <li>
              <span className={strong}>Usage data.</span> Which features you use, how many questions you ask, how many
              images you generate, and when, for the purpose of enforcing plan limits and improving the product.
            </li>
            <li>
              <span className={strong}>Technical and log data.</span> IP address, browser type, device type, and similar
              technical information, collected automatically by our hosting provider (Vercel) as part of standard web
              server operation.
            </li>
            <li>
              <span className={strong}>Cookies.</span> See Section 9.
            </li>
          </ul>

          <h3 className={h3}>2.3 Information we do not collect</h3>
          <p className={p}>
            We do not require you to upload or paste full book text into NovelViz. Book content is sourced from public
            domain catalogues (such as Project Gutenberg) or supplied directly by publisher and independent author
            partners who choose to list their work on NovelViz. We do not collect biometric data, precise geolocation,
            or government ID numbers.
          </p>
        </section>

        <section>
          <h2 className={h2}>3. How We Use Your Information</h2>
          <p className={p}>We use the information above to:</p>
          <ul className={ul}>
            <li>
              Provide the Service: answer your questions about books you&apos;re reading, generate images, track your
              library and progress
            </li>
            <li>
              Enforce chapter-based spoiler protection (this is the core function of the product, see Section 5)
            </li>
            <li>Enforce plan limits (free, standard, premium quotas) and process payments</li>
            <li>
              Send you operational notifications (e.g. quota reached, comment moderation outcomes) via in-app
              notifications
            </li>
            <li>
              Send administrative emails to our own team when you submit a contact form, book request, or partner
              application
            </li>
            <li>
              If you opt in, send you occasional email updates such as a monthly newsletter to keep you posted on new
              books, features, or community highlights. You can unsubscribe at any time, and we only send this with
              your consent.
            </li>
            <li>Improve the product, debug issues, and maintain security</li>
            <li>
              For partners: provide aggregated, non-identifying engagement statistics about how readers interact with
              their books (see Section 4.3)
            </li>
            <li>Comply with legal obligations</li>
          </ul>
          <p className={p}>
            We do not sell your personal information to third parties, and we do not use your reading history or
            questions to train AI models on behalf of third parties.
          </p>
        </section>

        <section>
          <h2 className={h2}>4. How We Share Your Information</h2>
          <p className={p}>
            We share information with the service providers (&quot;subprocessors&quot;) below, each of which processes
            data only to provide their specific function to us, under their own data processing and security terms.
          </p>
          <div className={tableWrap}>
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Provider</th>
                  <th className={thClass}>What they receive</th>
                  <th className={thClass}>Why</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={tdClass}>Clerk</td>
                  <td className={tdClass}>Email, name, authentication credentials</td>
                  <td className={tdClass}>Account creation and login</td>
                </tr>
                <tr>
                  <td className={tdClass}>Neon (PostgreSQL)</td>
                  <td className={tdClass}>
                    All application data (your profile, library, queries, generated content)
                  </td>
                  <td className={tdClass}>Database hosting</td>
                </tr>
                <tr>
                  <td className={tdClass}>Vercel</td>
                  <td className={tdClass}>IP address, request logs, all data in transit</td>
                  <td className={tdClass}>Application hosting</td>
                </tr>
                <tr>
                  <td className={tdClass}>Cloudinary</td>
                  <td className={tdClass}>Generated images, book cover images</td>
                  <td className={tdClass}>Image storage and delivery</td>
                </tr>
                <tr>
                  <td className={tdClass}>OpenAI</td>
                  <td className={tdClass}>
                    Text of your questions and image prompts (not your name or email)
                  </td>
                  <td className={tdClass}>Generates embeddings used for spoiler-safe content retrieval</td>
                </tr>
                <tr>
                  <td className={tdClass}>Anthropic</td>
                  <td className={tdClass}>
                    Text of your questions, relevant book excerpts (limited to chapters you&apos;ve reached), image
                    prompts
                  </td>
                  <td className={tdClass}>Generates Q&amp;A answers and enriches image generation prompts</td>
                </tr>
                <tr>
                  <td className={tdClass}>fal.ai</td>
                  <td className={tdClass}>Image generation prompts</td>
                  <td className={tdClass}>Generates the actual AI images you request</td>
                </tr>
                <tr>
                  <td className={tdClass}>Stripe</td>
                  <td className={tdClass}>
                    Name and email for the checkout session; payment details are collected and held by Stripe directly,
                    never by us
                  </td>
                  <td className={tdClass}>Subscription billing and credit purchases</td>
                </tr>
                <tr>
                  <td className={tdClass}>Resend</td>
                  <td className={tdClass}>Contact form and request submissions, sent to our internal team only</td>
                  <td className={tdClass}>Internal admin email alerts</td>
                </tr>
                <tr>
                  <td className={tdClass}>Loops (planned, not yet active)</td>
                  <td className={tdClass}>Email address, name</td>
                  <td className={tdClass}>
                    Monthly newsletter and other updates, sent only to users who opt in
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className={h3}>4.1 AI processing, what this actually means</h3>
          <p className={p}>
            When you ask a question or generate an image, the relevant excerpt of the book (limited only to chapters
            you&apos;ve already reached) and your question or prompt text are sent to OpenAI (for retrieval), and to
            Anthropic and fal.ai (to generate the response or image). These providers process this data to return a
            result to us. We do not have visibility into, or control over, their internal retention practices beyond
            what&apos;s stated in their own policies (for example, fal.ai&apos;s policy is at{" "}
            <Link
              href="https://fal.ai/legal/privacy-policy"
              className={linkClass}
              target="_blank"
              rel="noopener noreferrer"
            >
              fal.ai/legal/privacy-policy
            </Link>
            ). We do not permit these providers to use your data to train their general-purpose models, where their
            commercial or API terms allow us to opt out, and we use their business or API tiers rather than free consumer
            products for this reason.
          </p>

          <h3 className={h3}>4.2 Legal disclosures</h3>
          <p className={p}>
            We may disclose information if required by law, court order, or governmental request, or to protect the
            rights, property, or safety of NovelViz, our users, or others.
          </p>

          <h3 className={h3}>4.3 Publisher and partner data</h3>
          <p className={p}>
            Partners (publishers and authors who upload books) receive only aggregated, non-identifying statistics about
            how readers engage with their books, such as reader counts, chapter engagement heatmaps, and anonymized
            demographic breakdowns. Partners do not receive your name, email, or individual reading activity.
          </p>

          <h3 className={h3}>4.4 Business transfers</h3>
          <p className={p}>
            If NovelViz is acquired, merges, or sells assets, your information may be transferred as part of that
            transaction, subject to the commitments in this policy.
          </p>
        </section>

        <section>
          <h2 className={h2}>5. Why We Collect Reading Progress (Important Context)</h2>
          <p className={p}>
            NovelViz&apos;s core design principle is that AI features only ever draw on chapters you&apos;ve already
            read. We store your current chapter position for each book specifically so that we can prevent the AI from
            spoiling content you haven&apos;t reached yet, not for any other purpose. This data point exists for your
            protection, not for profiling.
          </p>
        </section>

        <section>
          <h2 className={h2}>6. Data Retention</h2>
          <p className={p}>
            When you delete your account, we delete your personal data immediately: your account record is removed
            directly from our database, and your authentication record is removed from Clerk. This is not a scheduled or
            batch process; it happens at the time of deletion.
          </p>
          <p className={p}>
            Your public gallery images and comments are handled slightly differently: we remove your username and any
            other identifying attribution from them, but the content itself may remain visible to other users rather
            than being deleted outright. Once that identifying link is removed, it&apos;s no longer tied to you. This
            applies in addition to the content-removal rules below; anything that was already a confirmed policy
            violation comes down regardless.
          </p>
          <p className={p}>
            <span className={strong}>Content removed for policy violations.</span> Separately from account-level
            retention, any specific image, question, or comment that we confirm violates our{" "}
            <Link href="/acceptable-use" className={linkClass}>
              Acceptable Use Policy
            </Link>{" "}
            is removed from public view as soon as that&apos;s confirmed, regardless of whether the associated account
            is active, suspended, or terminated. Content that hasn&apos;t been flagged isn&apos;t affected by another
            piece of content on the same account being removed. We keep an internal record of confirmed violations for
            enforcement history even after the content itself is taken down.
          </p>
          <p className={p}>
            Content involving apparent child sexual abuse material is handled as a distinct, urgent process: immediate
            removal from anywhere it could be accessed, followed by reporting to the appropriate authorities as required
            by law, which may include preserving a copy for investigators for a legally required period before final
            destruction.
          </p>
          <p className={p}>We also retain, regardless of account deletion:</p>
          <ul className={ul}>
            <li>Information we&apos;re required to keep for legal, tax, or fraud-prevention purposes</li>
            <li>Aggregated, de-identified usage statistics that no longer identify you</li>
            <li>Moderation records (strikes, appeals) needed to maintain platform integrity</li>
          </ul>
          <p className={p}>
            <span className={strong}>
              If your account has been suspended or permanently terminated for violating our{" "}
              <Link href="/terms" className={linkClass}>
                Terms of Service
              </Link>{" "}
              or{" "}
              <Link href="/acceptable-use" className={linkClass}>
                Acceptable Use Policy
              </Link>
              , you cannot delete your account, and we do not delete your account data, even though this is otherwise
              something we offer.
            </span>{" "}
            We retain this information to maintain accurate enforcement records and to prevent the same person from
            creating a new account to bypass a suspension or termination. This is a standard, recognized exception to
            data deletion rights under PIPEDA, GDPR, and similar frameworks, retaining records for fraud prevention
            and to enforce our own terms.
          </p>
        </section>

        <section>
          <h2 className={h2}>7. Your Privacy Rights</h2>
          <p className={p}>Regardless of where you live, you can always:</p>
          <ul className={ul}>
            <li>Access the personal data we hold about you</li>
            <li>Correct inaccurate data</li>
            <li>
              Delete your account and associated personal data (accounts suspended or permanently terminated for
              violating our{" "}
              <Link href="/terms" className={linkClass}>
                Terms of Service
              </Link>{" "}
              or{" "}
              <Link href="/acceptable-use" className={linkClass}>
                Acceptable Use Policy
              </Link>{" "}
              are an exception, see Section 6)
            </li>
            <li>Export your data in a portable format</li>
            <li>Opt out of any marketing email, including the monthly newsletter</li>
          </ul>
          <p className={p}>
            To exercise any of these rights, reach out via our{" "}
            <Link href="/contact" className={linkClass}>
              contact page
            </Link>{" "}
            or email{" "}
            <Link href="mailto:hello@novelviz.com" className={linkClass}>
              hello@novelviz.com
            </Link>
            . We will respond within a reasonable time, generally 30 days.
          </p>

          <h3 className={h3}>7.1 If you are a California resident</h3>
          <p className={p}>
            You have the right to know what categories of personal information we collect and for what purpose, to
            request deletion, and to non-discrimination for exercising your rights. We do not sell or &quot;share&quot;
            (as defined under California law) your personal information for cross-context behavioral advertising.
          </p>

          <h3 className={h3}>
            7.2 If you are in a US state with a comprehensive privacy law (California, Colorado, Connecticut, Virginia,
            and a growing list of others)
          </h3>
          <p className={p}>
            You may have rights to access, correct, delete, and port your data, and to opt out of targeted advertising,
            sale of data, or certain profiling. We do not engage in the sale of personal data or targeted third-party
            advertising. Where applicable, we honor Global Privacy Control (GPC) signals as an opt-out mechanism.
          </p>

          <h3 className={h3}>7.3 If you are in the European Economic Area or United Kingdom</h3>
          <p className={p}>
            Our lawful bases for processing are: performance of a contract (providing the Service you signed up for),
            legitimate interests (product improvement, security), and consent (where applicable, such as the optional
            newsletter). You have rights under GDPR including access, rectification, erasure, restriction, portability,
            and objection, and the right to lodge a complaint with your local data protection authority.
          </p>

          <h3 className={h3}>7.4 If you are in Canada</h3>
          <p className={p}>
            We process your personal information in accordance with PIPEDA. You have the right to access and request
            correction of your personal information.
          </p>
        </section>

        <section>
          <h2 className={h2}>8. Adult-Only Service</h2>
          <p className={p}>
            NovelViz is intended for users aged 18 and over. It is not directed at, or designed for, use by minors, and
            we do not knowingly collect personal information from anyone under 18.
          </p>
          <p className={p}>
            We ask users to accurately represent their age when they sign up, but we do not independently verify age or
            identity. If we become aware that we&apos;ve collected personal information from someone under 18, we will
            delete that account and the associated data.
          </p>
          <p className={p}>
            We are not currently set up to support classroom or institutional use involving minors. We may revisit this
            in the future, but it isn&apos;t supported today.
          </p>
        </section>

        <section>
          <h2 className={h2}>9. Cookies, Similar Technologies, and Third-Party Links</h2>
          <p className={p}>We use cookies and similar technologies for:</p>
          <ul className={ul}>
            <li>
              Essential functions, such as keeping you signed in (via Clerk), and remembering your theme preference and
              onboarding state
            </li>
            <li>
              Basic, privacy-respecting analytics to understand aggregate usage patterns and improve the product
            </li>
          </ul>
          <p className={p}>
            We do not currently use third-party advertising cookies or cross-site tracking. Because we don&apos;t
            currently use non-essential tracking cookies, we don&apos;t display a cookie consent banner; if that changes
            (for example, if we add third-party analytics or advertising tools), we will add a consent mechanism at that
            point.
          </p>
          <p className={p}>
            <span className={strong}>Affiliate links.</span> Some pages on NovelViz may include affiliate links to
            retailers such as Amazon, where we may earn a small commission if you make a purchase after clicking
            through. Clicking an affiliate link takes you to a third-party site, which has its own privacy practices and
            may set its own cookies or tracking, entirely outside of our control. We encourage you to review the privacy
            policy of any third-party site you visit through these links.
          </p>
        </section>

        <section>
          <h2 className={h2}>10. Data Security</h2>
          <p className={p}>
            We use industry-standard safeguards, including encrypted connections (HTTPS), access controls, and
            reputable infrastructure providers (Vercel, Neon, Clerk, Cloudinary) who maintain their own security
            certifications. No system is perfectly secure, and we cannot guarantee absolute security of your
            information.
          </p>
        </section>

        <section>
          <h2 className={h2}>11. International Data Transfers</h2>
          <p className={p}>
            NovelViz and its service providers operate infrastructure in multiple countries, including the United
            States. By using the Service, you understand that your information may be processed outside of your country
            of residence, including in countries that may have different data protection laws than your own. We take
            steps to ensure appropriate safeguards are in place with our providers.
          </p>
        </section>

        <section>
          <h2 className={h2}>12. Changes to This Policy</h2>
          <p className={p}>
            We may update this policy from time to time. If we make material changes, we will notify you via the Service
            or by email, and update the &quot;Last updated&quot; date above.
          </p>
        </section>

        <section>
          <h2 className={h2}>13. Contact Us</h2>
          <p className={p}>
            Questions about this policy or your data: reach out via our{" "}
            <Link href="/contact" className={linkClass}>
              contact page
            </Link>{" "}
            or email{" "}
            <Link href="mailto:hello@novelviz.com" className={linkClass}>
              hello@novelviz.com
            </Link>
            .
          </p>
          <p className={p}>
            NovelViz
            <br />
            Vancouver, British Columbia, Canada
          </p>
        </section>
      </div>
    </article>
  );
}
