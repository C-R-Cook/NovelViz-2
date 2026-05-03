import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | NovelViz",
  description: "How NovelViz collects, uses, and protects your personal data.",
};

const LAST_UPDATED = "May 1, 2026";

const h2 = "text-lg font-semibold tracking-tight text-zinc-900 sm:text-xl dark:text-zinc-100";
const p = "mt-3 text-sm leading-relaxed text-zinc-600 sm:text-[15px] dark:text-zinc-400";
const ul = "mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-600 sm:text-[15px] dark:text-zinc-400";
const linkClass =
  "text-amber-800 underline-offset-2 hover:text-amber-950 hover:underline dark:text-amber-400/95 dark:hover:text-amber-300";
const strong = "font-medium text-zinc-800 dark:text-zinc-300";

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 text-zinc-900 sm:px-6 sm:py-16 dark:text-zinc-100">
      <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">Privacy Policy</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Last updated: {LAST_UPDATED}</p>

        <div className="mt-10 space-y-8">
          <h2 className={h2}>Introduction</h2>
          <p className={p}>
            NovelViz (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates a web application that provides
            AI-assisted reading features. This Privacy Policy explains how we collect, use, store, and share
            information when you use our services.
          </p>

          <h2 className={h2}>What data we collect</h2>
          <ul className={ul}>
            <li>
              <span className={strong}>Account data:</span> When you sign up or sign in (for
              example via Clerk), we receive identifiers and profile information such as your name and email address
              as provided by the authentication provider.
            </li>
            <li>
              <span className={strong}>Reading activity:</span> We store your reading progress (for
              example current chapter), library membership, and related preferences necessary to run the product.
            </li>
            <li>
              <span className={strong}>AI interactions:</span> Questions you submit, model responses,
              and related metadata may be stored to provide the service, improve safety, and debug issues.
            </li>
            <li>
              <span className={strong}>Generated images:</span> If you use image generation, we
              store prompts, parameters, and resulting image URLs or references as needed to display history and
              enforce content policies.
            </li>
            <li>
              <span className={strong}>Technical data:</span> We may collect logs, device or browser
              type, IP address, and similar diagnostic information for security and reliability.
            </li>
          </ul>

          <h2 className={h2}>How we use your data</h2>
          <ul className={ul}>
            <li>To authenticate you, maintain your account, and provide core features.</li>
            <li>
              To power AI features (for example semantic search, Q&amp;A, and image generation) strictly in line with
              our product rules, including chapter gating where applicable.
            </li>
            <li>
              To produce aggregate or de-identified analytics (for example demand signals for publishers) where we do
              not identify you personally.
            </li>
            <li>To comply with law, enforce our terms, and protect users and the public.</li>
          </ul>

          <h2 className={h2}>Third-party services</h2>
          <p className={p}>We rely on subprocessors and infrastructure partners, including but not limited to:</p>
          <ul className={ul}>
            <li>
              <span className={strong}>Clerk</span> — authentication and session management.
            </li>
            <li>
              <span className={strong}>OpenAI</span> — embeddings and related model processing where
              used in the product.
            </li>
            <li>
              <span className={strong}>Anthropic</span> — Q&amp;A and related language model features
              (for example Claude).
            </li>
            <li>
              <span className={strong}>fal.ai</span> — image generation infrastructure where used.
            </li>
            <li>
              <span className={strong}>Cloudinary</span> — storage and delivery of user-generated and
              catalogue imagery.
            </li>
            <li>
              <span className={strong}>Neon</span> — hosted PostgreSQL database for application data.
            </li>
            <li>
              <span className={strong}>Vercel</span> — application hosting and edge delivery.
            </li>
          </ul>
          <p className={p}>
            These providers process data under their own terms and privacy policies. We choose vendors with reasonable
            security practices but are not responsible for their independent processing beyond our instructions where
            applicable.
          </p>

          <h2 className={h2}>Data retention</h2>
          <p className={p}>
            We retain information for as long as your account is active and as needed to provide the service, comply
            with legal obligations, resolve disputes, and enforce our agreements. Some backups or logs may persist for a
            limited additional period. When you delete your account, we delete or anonymise personal data subject to
            legal exceptions.
          </p>

          <h2 className={h2}>Your rights</h2>
          <p className={p}>Depending on your location, you may have rights to:</p>
          <ul className={ul}>
            <li>Access the personal data we hold about you.</li>
            <li>Request correction of inaccurate data.</li>
            <li>Request deletion of your account and associated personal data.</li>
            <li>Request portability of certain information in a machine-readable format.</li>
            <li>Object to or restrict certain processing where applicable by law.</li>
          </ul>
          <p className={p}>
            To exercise these rights, contact us at{" "}
            <Link href="mailto:privacy@novelviz.com" className={linkClass}>
              privacy@novelviz.com
            </Link>
            . We may need to verify your identity before responding.
          </p>

          <h2 className={h2}>Cookies and similar technologies</h2>
          <p className={p}>
            We and our providers may use cookies, local storage, and similar technologies to keep you signed in,
            remember preferences, measure performance, and prevent abuse. You can control cookies through your browser
            settings; disabling some cookies may limit functionality.
          </p>

          <h2 className={h2}>Children</h2>
          <p className={p}>
            NovelViz is not directed at children under 13 (or the minimum age in your jurisdiction). We do not
            knowingly collect personal information from children.
          </p>

          <h2 className={h2}>International transfers</h2>
          <p className={p}>
            Your information may be processed in countries other than where you live. Where required, we use
            appropriate safeguards for cross-border transfers.
          </p>

          <h2 className={h2}>Changes to this policy</h2>
          <p className={p}>
            We may update this Privacy Policy from time to time. We will post the revised version on this page and
            update the &quot;Last updated&quot; date. Material changes may be communicated through the product or by
            email where appropriate.
          </p>

          <h2 className={h2}>Contact</h2>
          <p className={p}>
            For privacy-related questions or requests:{" "}
            <Link href="mailto:privacy@novelviz.com" className={linkClass}>
              privacy@novelviz.com
            </Link>
          </p>
        </div>
    </article>
  );
}
