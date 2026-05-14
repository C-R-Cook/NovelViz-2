"use client";

import { type FormEvent, useCallback, useState } from "react";
import Link from "next/link";

type Props = {
  lockedFullName: string;
  lockedUsername: string | null;
  lockedEmail: string;
};

function PartnerGemDivider() {
  return (
    <div className="dashboard-section-divider" aria-hidden>
      <span className="dashboard-divider-line" />
      <span className="dashboard-divider-gem">✦</span>
      <span className="dashboard-divider-line" />
    </div>
  );
}

function SectionLabelRow({ label }: { label: string }) {
  return (
    <div className="dashboard-slabel-row dashboard-partner-slabel-tight">
      <span className="dashboard-slabel">{label}</span>
      <span className="dashboard-slabel-line" aria-hidden />
    </div>
  );
}

function IconEngagedReaders({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" width={40} height={40} aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth={1.35} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 28V14l8-4 8 4v14" />
        <path d="M20 10V6M28 12l3-2M12 12L9 10M30 20h4M6 20H2M28 28l3 2M12 28l-3 2" opacity={0.85} />
        <path d="M16 18h8M16 22h5" opacity={0.55} />
      </g>
    </svg>
  );
}

function IconAnalytics({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" width={40} height={40} aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth={1.35} strokeLinecap="round">
        <path d="M8 30h26" opacity={0.45} />
        <rect x={10} y={22} width={4} height={8} rx={0.5} />
        <rect x={18} y={16} width={4} height={14} rx={0.5} />
        <rect x={26} y={12} width={4} height={18} rx={0.5} />
        <path d="M12 14c3-4 6-5 10-3" opacity={0.7} />
      </g>
    </svg>
  );
}

function IconCatalogue({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" width={40} height={40} aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth={1.35} strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 8h12v24H14a2 2 0 01-2-2V10a2 2 0 012-2z" />
        <path d="M26 8h2a2 2 0 012 2v20a2 2 0 01-2 2h-2" />
        <path d="M18 16l2 2 4-5" opacity={0.85} />
        <path d="M17 24h8" opacity={0.45} />
      </g>
    </svg>
  );
}

export function DashboardPartnerSection({ lockedFullName, lockedUsername, lockedEmail }: Props) {
  const usernameFieldValue = lockedUsername ? `@${lockedUsername}` : "—";

  const [pseudonym, setPseudonym] = useState("");
  const [publisherName, setPublisherName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [catalogueDescription, setCatalogueDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      setSubmitting(true);
      try {
        const res = await fetch("/api/partner-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pseudonym: pseudonym.trim() || undefined,
            publisherName,
            websiteUrl: websiteUrl.trim() || undefined,
            catalogueDescription,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string };
        if (!res.ok) {
          setError(typeof data.message === "string" ? data.message : "Something went wrong. Please try again.");
          return;
        }
        if (data.success) {
          setSuccess(true);
        }
      } finally {
        setSubmitting(false);
      }
    },
    [pseudonym, publisherName, websiteUrl, catalogueDescription],
  );

  return (
    <div className="dashboard-partner">
      <header className="dashboard-partner-hero dashboard-partner-reveal" data-stagger="0">
        <p className="dashboard-partner-eyebrow">Publisher partnership</p>
        <h2 className="dashboard-partner-shimmer">Grow With Your Readers</h2>
        <p className="dashboard-partner-lede">
          NovelViz connects publishers and authors directly with active readers who are deeply engaged with their books — chapter by chapter. This is where the relationship starts.
        </p>
      </header>

      <div className="dashboard-partner-cards">
        <article className="dashboard-partner-card dashboard-partner-reveal" data-stagger="1">
          <div className="dashboard-partner-card-icon" aria-hidden>
            <IconEngagedReaders className="dashboard-partner-card-svg" />
          </div>
          <h3 className="dashboard-partner-card-title">Reach engaged readers</h3>
          <p className="dashboard-partner-card-copy">
            Your books reach readers who are actively reading, not just browsing. Every Q&amp;A session and generated image is a signal of genuine engagement.
          </p>
        </article>
        <article className="dashboard-partner-card dashboard-partner-reveal" data-stagger="2">
          <div className="dashboard-partner-card-icon" aria-hidden>
            <IconAnalytics className="dashboard-partner-card-svg" />
          </div>
          <h3 className="dashboard-partner-card-title">Chapter-level analytics</h3>
          <p className="dashboard-partner-card-copy">
            See exactly where readers slow down, what they ask, and which chapters spark the most conversation. Reader intelligence, not just download counts.
          </p>
        </article>
        <article className="dashboard-partner-card dashboard-partner-reveal" data-stagger="3">
          <div className="dashboard-partner-card-icon" aria-hidden>
            <IconCatalogue className="dashboard-partner-card-svg" />
          </div>
          <h3 className="dashboard-partner-card-title">Your books, beautifully presented</h3>
          <p className="dashboard-partner-card-copy">
            Your titles appear in our curated catalogue alongside timeless public domain works, with the same cinematic presentation readers expect.
          </p>
        </article>
      </div>

      <p className="dashboard-partner-faq-note dashboard-partner-reveal" data-stagger="4">
        The same topics in a formal Q&amp;A format live in our{" "}
        <Link href="/faq#publisher-partnership" className="dashboard-partner-faq-note-link">
          FAQ
        </Link>
        .
      </p>

      <PartnerGemDivider />

      <section className="dashboard-partner-steps-wrap" aria-labelledby="dashboard-partner-how-heading">
        <SectionLabelRow label="How it works" />
        <h3 id="dashboard-partner-how-heading" className="dashboard-partner-sr-only">
          How it works
        </h3>
        <ol className="dashboard-partner-steps">
          <li className="dashboard-partner-step dashboard-partner-reveal" data-stagger="5">
            <span className="dashboard-partner-step-num" aria-hidden>
              1
            </span>
            <span className="dashboard-partner-step-title">Tell us about your catalogue</span>
            <span className="dashboard-partner-step-desc">A short expression of interest. No lengthy process.</span>
          </li>
          <li className="dashboard-partner-step dashboard-partner-reveal" data-stagger="6">
            <span className="dashboard-partner-step-num" aria-hidden>
              2
            </span>
            <span className="dashboard-partner-step-title">We set you up</span>
            <span className="dashboard-partner-step-desc">
              We configure your partner account, you upload your titles and set chapter counts.
            </span>
          </li>
          <li className="dashboard-partner-step dashboard-partner-reveal" data-stagger="7">
            <span className="dashboard-partner-step-num" aria-hidden>
              3
            </span>
            <span className="dashboard-partner-step-title">Watch readers engage</span>
            <span className="dashboard-partner-step-desc">
              Your analytics dashboard is live from the moment your first reader adds a book.
            </span>
          </li>
        </ol>
      </section>

      <PartnerGemDivider />

      <section className="dashboard-partner-form-section dashboard-partner-reveal" data-stagger="8" aria-labelledby="dashboard-partner-form-heading">
        <SectionLabelRow label="Get started" />
        {success ? (
          <div className="dashboard-partner-success">
            <p className="dashboard-partner-eyebrow dashboard-partner-success-eyebrow">Request received</p>
            <p className="dashboard-partner-success-gem" aria-hidden>
              ✦
            </p>
            <h3 id="dashboard-partner-form-heading" className="dashboard-partner-success-title">
              We&apos;ll be in touch soon
            </h3>
            <p className="dashboard-partner-success-note">
              Look for a note from us within a couple of business days — we&apos;re excited to learn more about your catalogue.
            </p>
          </div>
        ) : (
          <>
            <h3 id="dashboard-partner-form-heading" className="dashboard-partner-form-headline">
              Tell us about your books
            </h3>
            <p className="dashboard-partner-form-intro">
              Fill in a few details and we&apos;ll be in touch within a couple of business days.
            </p>
            <form className="dashboard-partner-form" onSubmit={onSubmit}>
              <p className="dashboard-partner-locked-hint">
                Your NovelViz account details below are included with this request and cannot be changed here.
              </p>
              <div className="dashboard-partner-field-row">
                <label className="dashboard-partner-field">
                  <span className="dashboard-partner-label">Full name</span>
                  <input
                    className="dashboard-partner-input dashboard-partner-input--locked"
                    name="lockedFullName"
                    autoComplete="off"
                    value={lockedFullName}
                    disabled
                    tabIndex={-1}
                    aria-readonly="true"
                  />
                </label>
                <label className="dashboard-partner-field">
                  <span className="dashboard-partner-label">Username</span>
                  <input
                    className="dashboard-partner-input dashboard-partner-input--locked"
                    name="lockedUsername"
                    autoComplete="off"
                    value={usernameFieldValue}
                    disabled
                    tabIndex={-1}
                    aria-readonly="true"
                    aria-label={lockedUsername ? `Username ${usernameFieldValue}` : "No username on your account"}
                  />
                </label>
              </div>
              <label className="dashboard-partner-field">
                <span className="dashboard-partner-label">Email</span>
                <input
                  className="dashboard-partner-input dashboard-partner-input--locked"
                  name="lockedEmail"
                  type="email"
                  autoComplete="off"
                  value={lockedEmail}
                  disabled
                  tabIndex={-1}
                  aria-readonly="true"
                />
              </label>
              <div className="dashboard-partner-field-row">
                <label className="dashboard-partner-field">
                  <span className="dashboard-partner-label">
                    Pseudonym <span className="dashboard-partner-optional">(optional)</span>
                  </span>
                  <input
                    className="dashboard-partner-input"
                    name="pseudonym"
                    autoComplete="nickname"
                    placeholder="How you'd like to be addressed in replies"
                    value={pseudonym}
                    onChange={(ev) => setPseudonym(ev.target.value)}
                    maxLength={120}
                  />
                </label>
                <label className="dashboard-partner-field">
                  <span className="dashboard-partner-label">Publisher or author name / imprint</span>
                  <input
                    className="dashboard-partner-input"
                    name="publisherName"
                    value={publisherName}
                    onChange={(ev) => setPublisherName(ev.target.value)}
                    required
                  />
                </label>
              </div>
              <label className="dashboard-partner-field">
                <span className="dashboard-partner-label">
                  Website or social link <span className="dashboard-partner-optional">(optional)</span>
                </span>
                <input
                  className="dashboard-partner-input"
                  name="websiteUrl"
                  type="url"
                  inputMode="url"
                  placeholder="https://"
                  value={websiteUrl}
                  onChange={(ev) => setWebsiteUrl(ev.target.value)}
                />
              </label>
              <label className="dashboard-partner-field">
                <span className="dashboard-partner-label">Tell us about your catalogue</span>
                <textarea
                  className="dashboard-partner-input dashboard-partner-textarea"
                  name="catalogueDescription"
                  rows={5}
                  required
                  value={catalogueDescription}
                  onChange={(ev) => setCatalogueDescription(ev.target.value)}
                  placeholder="What genres do you publish? Roughly how many titles? Any specific books you'd like to see on NovelViz?"
                />
              </label>
              {error ? (
                <p className="dashboard-partner-error" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="dashboard-partner-submit-wrap">
                <button type="submit" className="dashboard-partner-submit" disabled={submitting}>
                  {submitting ? "Sending…" : "Send Expression of Interest"}
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
