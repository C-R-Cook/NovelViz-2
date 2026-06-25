# NovelViz Acceptable Use Policy (DRAFT)

**Last updated:** [DATE]
**Effective date:** [DATE]

> This is a working draft, not a finished legal document. It has not been reviewed by a lawyer. See the internal notes at the end for open items before publishing.

---

## Purpose

This policy describes what you can and can't do with NovelViz, including the questions you ask, the prompts you submit for image generation, the comments you post, and the images and text the Service generates in response. It's part of our [Terms of Service](/terms) and applies to everyone using NovelViz.

We built NovelViz to help people enjoy books without spoilers, not as a general-purpose AI generation tool. These rules reflect that.

---

## 1. Sexual content involving minors

This is the one absolute line. Don't use NovelViz to create, request, or attempt to create any sexual or exploitative content involving minors, in any form, regardless of whether a character in a book is a minor in the story. This applies even where a book's source material includes a minor character. Generating or requesting sexualized content about that character, or about anyone else, real or fictional, is never permitted. We report apparent child sexual abuse material to the appropriate authorities (see internal notes on specific reporting obligations).

This is a zero-tolerance rule. Violations result in immediate account termination without warning, and may be reported to law enforcement.

## 2. Real people

Don't use NovelViz to:

- Generate sexual, intimate, or non-consensual imagery of a real person
- Impersonate a real person or generate content designed to deceive others about who created it or who it depicts
- Generate content that harasses, defames, or threatens a specific real person

NovelViz's image generation is meant for characters and scenes from books, not for creating images of real individuals.

## 3. Harassment and hate

Don't use the Q&A, comments, or any other feature of NovelViz to:

- Harass, threaten, or bully another person
- Post hate speech, slurs, or content that demeans people based on a protected characteristic (such as race, ethnicity, religion, gender, sexual orientation, or disability)
- Incite violence against any person or group

## 4. Violent and graphic content

Many books NovelViz supports include violence, including disturbing violence, as part of their actual story content, and our Q&A and image features are allowed to reflect what's genuinely in the source material you've reached. What's not allowed is using NovelViz to push beyond that, for example:

- Requesting gratuitously graphic, torture-focused, or exploitative depictions that go well beyond what the book itself describes
- Using the image generator to create graphic real-world violence unconnected to the book you're reading

## 5. Illegal activity

Don't use NovelViz to generate or facilitate anything illegal, including instructions for creating weapons, drugs, or other regulated or dangerous items, fraud or scams, or any other criminal activity.

## 6. Intellectual property and impersonation of works

Don't use NovelViz to:

- Generate content that infringes someone else's copyright or trademark beyond what's reasonably part of discussing or illustrating a book you have access to within the Service
- Upload book content you don't have the rights to upload (see our Terms of Service, Section 7, if you're a partner)

## 7. Misuse of the Service itself

Don't:

- Attempt to bypass, disable, or interfere with our spoiler-gating system, content moderation, or usage limits
- Attempt to extract, reverse-engineer, or determine the underlying AI models or system prompts behind NovelViz's features
- Use automated tools to scrape, bulk-generate, or abuse the Service beyond normal personal use
- Use the Service to test or probe our systems for vulnerabilities without authorization

## 8. Privacy and personal information

Don't submit another person's private or sensitive personal information through NovelViz's Q&A or comments, such as their address, financial details, or health information, without their consent.

---

## How We Enforce This Policy

NovelViz uses an automated, multi-layer moderation system to review content before and after it's generated, including keyword-based screening, AI-based content classification, and detection of refusals from our underlying AI providers (which have their own content policies independent of ours).

- **Minor or first-time issues** typically result in a flag on your account. Repeated flags may lead to a temporary suspension, and continued violations can lead to permanent suspension.
- **Severe violations**, including anything in Section 1 or 2 above, result in immediate suspension or termination without warning.
- **If you believe a flag or suspension was a mistake**, you can appeal through your account. Appeals are reviewed by an admin, and false positives are cleared without penalty.
- We may also remove specific content (a comment, an image) without suspending your account, where that's a more proportionate response.

## Reporting Violations

If you see something on NovelViz that violates this policy, please report it via our [contact page](/contact) or by emailing hello@novelviz.com.

## Relationship to Third-Party AI Providers

NovelViz's Q&A and image generation features rely on third-party AI providers (currently Anthropic and OpenAI for Q&A and embeddings, and fal.ai for image generation). These providers have their own acceptable use and content policies, and may decline to process a request even if it wouldn't otherwise violate this policy. We have no obligation to provide an alternative path around a third-party provider's refusal.

## Changes to This Policy

We may update this policy as our moderation systems and product evolve. Material changes will be reflected in the date above. Continued use of the Service after a change takes effect means you accept the updated policy.

---

## Internal notes, NOT for publication (delete before publishing)

1. Section 1's reporting line is intentionally vague ("appropriate authorities") because the actual mechanics are a real compliance question, not something to freelance. Canada has a mandatory reporting framework for online service providers that route through the Canadian Centre for Child Protection (Cybertip.ca), and US-facing services often also reference NCMEC. Confirm with a lawyer exactly what NovelViz's reporting obligations are, given you're Canada-based but may have US users, before this section is finalized. This is one of the few places in either legal document where getting the wording wrong has real consequences beyond a bad customer experience.
2. This policy deliberately leaves out most of fal.ai's enterprise-platform-specific categories: sanctioned-country exclusions, Team Organization/end-user administration, terrorism/extremism content, and model-training-data extraction. None of these map to NovelViz's actual product shape today. Revisit if NovelViz ever opens up a more general-purpose API or end-user integration model later.
3. Section 4 (violent and graphic content) is the section most likely to need real-world tuning once your moderation system has live data, "gratuitous beyond what the book describes" is a workable principle but a genuinely hard line for an automated classifier to draw consistently. Expect to revisit the keyword/classification thresholds here based on actual false positives and negatives once the moderation system referenced in `NOVELVIZ_REFERENCE_v11.md` is live.
4. This document also needs its own document-version constant if you want it to participate in the same kind of versioned-acceptance tracking as Terms and Privacy, though note this policy isn't currently part of the three mandatory checkbox attestations at signup. Decide whether it should be (a fourth attestation) or whether being incorporated by reference into the Terms of Service is sufficient. Leaning toward the latter to avoid re-opening the consent-flow work you just simplified.
5. Have an actual lawyer review Section 1 specifically, given the reporting-obligation question above, before this goes live.
