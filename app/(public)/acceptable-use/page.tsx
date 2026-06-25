import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Acceptable Use Policy | NovelViz",
  description: "Rules for using NovelViz and the content you create on the platform.",
};

const LAST_UPDATED = "June 25, 2026";
const EFFECTIVE_DATE = "June 25, 2026";

const h2 = "text-lg font-semibold tracking-tight text-text-primary sm:text-xl";
const p = "mt-3 text-sm leading-relaxed text-text-muted sm:text-[15px]";
const ul = "mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-text-muted sm:text-[15px]";
const linkClass =
  "text-accent-text underline-offset-2 hover:text-text-primary hover:underline";
const strong = "font-medium text-text-primary";

export default function AcceptableUsePage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 text-text-primary sm:px-6 sm:py-16">
      <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
        Acceptable Use Policy
      </h1>
      <p className="mt-2 text-sm text-text-secondary">Last updated: {LAST_UPDATED}</p>
      <p className="mt-1 text-sm text-text-secondary">Effective date: {EFFECTIVE_DATE}</p>

      <div className="mt-10 space-y-8">
        <section>
          <h2 className={h2}>Purpose</h2>
          <p className={p}>
            This policy describes what you can and can&apos;t do with NovelViz, including the questions you ask, the
            prompts you submit for image generation, the comments you post, and the images and text the Service
            generates in response. It&apos;s part of our{" "}
            <Link href="/terms" className={linkClass}>
              Terms of Service
            </Link>{" "}
            and applies to everyone using NovelViz.
          </p>
          <p className={p}>
            We built NovelViz to help people enjoy books without spoilers, not as a general-purpose AI generation
            tool. These rules reflect that.
          </p>
        </section>

        <section>
          <h2 className={h2}>1. Sexual content involving minors</h2>
          <p className={p}>
            This is the one absolute line. Don&apos;t use NovelViz to create, request, or attempt to create any sexual
            or exploitative content involving minors, in any form, regardless of whether a character in a book is a
            minor in the story. This applies even where a book&apos;s source material includes a minor character.
            Generating or requesting sexualized content about that character, or about anyone else, real or fictional,
            is never permitted. We report apparent child sexual abuse material to the appropriate authorities as
            required by law.
          </p>
          <p className={p}>
            This is a zero-tolerance rule. Violations result in immediate account termination without warning, and may
            be reported to law enforcement.
          </p>
        </section>

        <section>
          <h2 className={h2}>2. Real people</h2>
          <p className={p}>Don&apos;t use NovelViz to:</p>
          <ul className={ul}>
            <li>Generate sexual, intimate, or non-consensual imagery of a real person</li>
            <li>
              Impersonate a real person or generate content designed to deceive others about who created it or who it
              depicts
            </li>
            <li>Generate content that harasses, defames, or threatens a specific real person</li>
          </ul>
          <p className={p}>
            NovelViz&apos;s image generation is meant for characters and scenes from books, not for creating images of
            real individuals.
          </p>
        </section>

        <section>
          <h2 className={h2}>3. Harassment and hate</h2>
          <p className={p}>Don&apos;t use the Q&amp;A, comments, or any other feature of NovelViz to:</p>
          <ul className={ul}>
            <li>Harass, threaten, or bully another person</li>
            <li>
              Post hate speech, slurs, or content that demeans people based on a protected characteristic (such as
              race, ethnicity, religion, gender, sexual orientation, or disability)
            </li>
            <li>Incite violence against any person or group</li>
          </ul>
        </section>

        <section>
          <h2 className={h2}>4. Violent and graphic content</h2>
          <p className={p}>
            Many books NovelViz supports include violence, including disturbing violence, as part of their actual story
            content, and our Q&amp;A and image features are allowed to reflect what&apos;s genuinely in the source
            material you&apos;ve reached. What&apos;s not allowed is using NovelViz to push beyond that, for example:
          </p>
          <ul className={ul}>
            <li>
              Requesting gratuitously graphic, torture-focused, or exploitative depictions that go well beyond what the
              book itself describes
            </li>
            <li>Using the image generator to create graphic real-world violence unconnected to the book you&apos;re reading</li>
          </ul>
        </section>

        <section>
          <h2 className={h2}>5. Illegal activity</h2>
          <p className={p}>
            Don&apos;t use NovelViz to generate or facilitate anything illegal, including instructions for creating
            weapons, drugs, or other regulated or dangerous items, fraud or scams, or any other criminal activity.
          </p>
        </section>

        <section>
          <h2 className={h2}>6. Intellectual property and impersonation of works</h2>
          <p className={p}>Don&apos;t use NovelViz to:</p>
          <ul className={ul}>
            <li>
              Generate content that infringes someone else&apos;s copyright or trademark beyond what&apos;s reasonably
              part of discussing or illustrating a book you have access to within the Service
            </li>
            <li>
              Upload book content you don&apos;t have the rights to upload (see our{" "}
              <Link href="/terms" className={linkClass}>
                Terms of Service
              </Link>
              , Section 7, if you&apos;re a partner)
            </li>
          </ul>
        </section>

        <section>
          <h2 className={h2}>7. Misuse of the Service itself</h2>
          <p className={p}>Don&apos;t:</p>
          <ul className={ul}>
            <li>
              Attempt to bypass, disable, or interfere with our spoiler-gating system, content moderation, or usage
              limits
            </li>
            <li>
              Attempt to extract, reverse-engineer, or determine the underlying AI models or system prompts behind
              NovelViz&apos;s features
            </li>
            <li>Use automated tools to scrape, bulk-generate, or abuse the Service beyond normal personal use</li>
            <li>Use the Service to test or probe our systems for vulnerabilities without authorization</li>
          </ul>
        </section>

        <section>
          <h2 className={h2}>8. Privacy and personal information</h2>
          <p className={p}>
            Don&apos;t submit another person&apos;s private or sensitive personal information through NovelViz&apos;s
            Q&amp;A or comments, such as their address, financial details, or health information, without their
            consent.
          </p>
        </section>

        <section>
          <h2 className={h2}>How We Enforce This Policy</h2>
          <p className={p}>
            NovelViz uses an automated, multi-layer moderation system to review content before and after it&apos;s
            generated, including keyword-based screening, AI-based content classification, and detection of refusals from
            our underlying AI providers (which have their own content policies independent of ours).
          </p>
          <ul className={ul}>
            <li>
              <span className={strong}>Minor or first-time issues</span> typically result in a flag on your account.
              Repeated flags may lead to a temporary suspension, and continued violations can lead to permanent
              suspension.
            </li>
            <li>
              <span className={strong}>Severe violations</span>, including anything in Section 1 or 2 above, result in
              immediate suspension or termination without warning.
            </li>
            <li>
              <span className={strong}>If you believe a flag or suspension was a mistake</span>, you can appeal through
              your account. Appeals are reviewed by an admin, and false positives are cleared without penalty.
            </li>
            <li>
              We may also remove specific content (a comment, an image) without suspending your account, where
              that&apos;s a more proportionate response.
            </li>
          </ul>
        </section>

        <section>
          <h2 className={h2}>Reporting Violations</h2>
          <p className={p}>
            If you see something on NovelViz that violates this policy, please report it via our{" "}
            <Link href="/contact" className={linkClass}>
              contact page
            </Link>{" "}
            or by emailing{" "}
            <Link href="mailto:hello@novelviz.com" className={linkClass}>
              hello@novelviz.com
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className={h2}>Relationship to Third-Party AI Providers</h2>
          <p className={p}>
            NovelViz&apos;s Q&amp;A and image generation features rely on third-party AI providers (currently Anthropic
            and OpenAI for Q&amp;A and embeddings, and fal.ai for image generation). These providers have their own
            acceptable use and content policies, and may decline to process a request even if it wouldn&apos;t otherwise
            violate this policy. We have no obligation to provide an alternative path around a third-party
            provider&apos;s refusal.
          </p>
        </section>

        <section>
          <h2 className={h2}>Changes to This Policy</h2>
          <p className={p}>
            We may update this policy as our moderation systems and product evolve. Material changes will be reflected
            in the date above. Continued use of the Service after a change takes effect means you accept the updated
            policy.
          </p>
        </section>
      </div>
    </article>
  );
}
