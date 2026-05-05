import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | NovelViz",
  description: "Terms governing your use of NovelViz.",
};

const LAST_UPDATED = "May 1, 2026";

const h2 = "text-lg font-semibold tracking-tight text-text-primary sm:text-xl";
const p = "mt-3 text-sm leading-relaxed text-text-muted sm:text-[15px]";
const ul = "mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-text-muted sm:text-[15px]";
const linkClass =
  "text-accent-text underline-offset-2 hover:text-text-primary hover:underline";
const emStrong = "font-semibold text-text-primary";

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 text-text-primary sm:px-6 sm:py-16">
      <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">Terms of Service</h1>
      <p className="mt-2 text-sm text-text-secondary">Last updated: {LAST_UPDATED}</p>

      <div className="mt-10 space-y-8">
          <h2 className={h2}>1. Acceptance of terms</h2>
          <p className={p}>
            By accessing or using NovelViz (&quot;Service&quot;), you agree to these Terms of Service. If you do not
            agree, do not use the Service. We may refuse service to anyone at any time.
          </p>

          <h2 className={h2}>2. Description of service</h2>
          <p className={p}>
            NovelViz provides AI-assisted tools for readers and workflows for partners, including question answering,
            image generation, library features, and related functionality. Features may change, be suspended, or be
            discontinued. We may introduce paid subscription tiers or usage limits in the future; where we do, we
            will provide reasonable notice as described in these terms or in-product.
          </p>

          <h2 className={h2}>3. Eligibility and accounts</h2>
          <p className={p}>
            You must provide accurate registration information and keep your credentials secure. You are responsible
            for activity under your account. Notify us promptly of unauthorised use.
          </p>

          <h2 className={h2}>4. User responsibilities</h2>
          <ul className={ul}>
            <li>You will comply with all applicable laws and these Terms.</li>
            <li>You will not attempt to disrupt, overload, reverse engineer, or misuse the Service.</li>
            <li>You will not use the Service to harass others, generate unlawful content, or infringe third-party rights.</li>
          </ul>

          <h2 className={h2}>5. You must own the books you use</h2>
          <p className={p}>
            NovelViz is designed as a companion for books you lawfully own or are otherwise entitled to use. You
            represent that you have the rights necessary to use book content with the Service in your jurisdiction. We
            do not grant you a licence to reproduce or redistribute full book text through the Service.
          </p>

          <h2 className={h2}>6. Content and ownership</h2>
          <p className={p}>
            As between you and NovelViz, you retain ownership of images and other materials you generate using the
            Service, subject to our licence to host, process, and display them as needed to operate the product and as
            you choose to share (for example to a public gallery). Catalogue and software remain owned by NovelViz or
            its licensors.
          </p>

          <h2 className={h2}>7. Prohibited uses</h2>
          <p className={p}>You may not:</p>
          <ul className={ul}>
            <li>Use the Service to violate copyright, trademark, privacy, or other rights.</li>
            <li>Attempt to extract model weights, training data, or proprietary systems.</li>
            <li>Circumvent technical limitations such as chapter gating or rate limits.</li>
            <li>Use automated means to scrape or bulk-access the Service without permission.</li>
          </ul>

          <h2 className={h2}>8. Partners and publishers</h2>
          <p className={p}>
            If you access partner or publisher features, additional agreements may apply. You are responsible for
            accurate metadata, lawful uploads, and honouring reader-facing commitments. You will not upload content
            you do not have rights to distribute for processing.
          </p>

          <h2 className={h2}>9. AI outputs and disclaimer</h2>
          <p className={p}>
            AI-generated answers and images may be incorrect, incomplete, or inappropriate. The Service is provided
            &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, whether express, implied, or
            statutory, including merchantability, fitness for a particular purpose, and non-infringement, to the fullest
            extent permitted by law.
          </p>

          <h2 className={h2}>10. Limitation of liability</h2>
          <p className={p}>
            To the maximum extent permitted by law, NovelViz and its suppliers will not be liable for any indirect,
            incidental, special, consequential, or punitive damages, or for loss of profits, data, or goodwill, arising
            from your use of the Service. Our aggregate liability for any claim arising out of these Terms or the
            Service will not exceed the greater of (a) the amounts you paid us for the Service in the twelve (12)
            months before the claim or (b) one hundred US dollars (US$100), except where liability cannot be limited by
            law.
          </p>

          <h2 className={h2}>11. Indemnity</h2>
          <p className={p}>
            You will defend and indemnify NovelViz against claims arising from your use of the Service, your content,
            or your violation of these Terms, subject to our prompt notice and reasonable cooperation.
          </p>

          <h2 className={h2}>12. Governing law</h2>
          <p className={p}>
            These Terms are governed by the laws of <strong className={emStrong}>[JURISDICTION]</strong>, without regard
            to conflict-of-law principles. Courts in <strong className={emStrong}>[JURISDICTION]</strong>{" "}
            will have exclusive jurisdiction, except where prohibited by applicable consumer protection law.
          </p>

          <h2 className={h2}>13. Changes to terms</h2>
          <p className={p}>
            We may modify these Terms at any time. We will post the updated version on this page and revise the
            &quot;Last updated&quot; date. Continued use after changes constitutes acceptance. If changes are material,
            we may provide additional notice (for example by email or in-product message).
          </p>

          <h2 className={h2}>14. Contact</h2>
          <p className={p}>
            For legal notices or questions about these Terms:{" "}
            <Link href="mailto:legal@novelviz.com" className={linkClass}>
              legal@novelviz.com
            </Link>
          </p>
      </div>
    </article>
  );
}
