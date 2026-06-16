"use client";

import { DiscoverParticleField } from "@/components/discover-particle-field";
import { ImageThumbnailBottomBar } from "@/components/image-thumbnail-bottom-bar";
import type { FeaturedImageCard } from "@/lib/featured-image-selection";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const MARQUEE_TITLES = [
  "Dracula",
  "Jane Eyre",
  "Frankenstein",
  "Alice in Wonderland",
  "Moby Dick",
  "Pride & Prejudice",
  "The Picture of Dorian Gray",
  "Wuthering Heights",
  "The Wizard of Oz",
  "Treasure Island",
];

const PRIMARY_FEATURES = [
  {
    icon: "🔒",
    title: "Spoiler-Free Q&A",
    body: "Ask anything about plot, themes, characters, or writing style. Your AI companion answers only from chapters you've already read.",
  },
  {
    icon: "◻",
    title: "Chapter-Gated Images",
    body: "Generate illustrations from scenes you've encountered. Each image is locked to your current chapter — you'll never see a character before they appear.",
  },
  {
    icon: "◈",
    title: "Community Gallery",
    body: "Browse images created by other readers — gated to protect you from seeing scenes beyond your progress. Your spoiler settings travel with you.",
  },
];

const SECONDARY_FEATURES = [
  [
    "Public Domain Library",
    "Every book in our catalogue is from Project Gutenberg — no licensing, no fees, no gatekeeping. Just great literature.",
  ],
  [
    "Progress Tracking",
    "Your AI knows exactly where you are. Declare your chapter and everything adapts — Q&A, images, gallery visibility.",
  ],
  [
    "Spoiler Protection Controls",
    "Global protection, per-book overrides, and session unlocks. You decide exactly what you're willing to see.",
  ],
] as const;

const STEPS = [
  {
    number: "01",
    title: "Add a book to your library",
    body: "Browse our public domain catalogue — Dracula, Jane Eyre, Frankenstein, and dozens more. Declare which books you own. No in-app reading required.",
  },
  {
    number: "02",
    title: "Track your reading progress",
    body: "Tell NovelViz which chapter you're on. This is the only number that matters — it gates everything your AI companion is allowed to know.",
  },
  {
    number: "03",
    title: "Ask anything. Generate anything.",
    body: "Chat with your AI companion about plot, themes, characters. Generate images of scenes you've encountered. Every interaction is sealed to your current chapter.",
  },
] as const;

function useReveal(threshold = 0.15) {
  const [visible, setVisible] = useState(false);

  const ref = useCallback(
    (el: HTMLElement | null) => {
      if (!el) return;

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) {
        queueMicrotask(() => setVisible(true));
        return;
      }

      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) {
            setVisible(true);
            obs.disconnect();
          }
        },
        { threshold },
      );
      obs.observe(el);
      return () => obs.disconnect();
    },
    [threshold],
  );

  return [ref, visible] as const;
}

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return reducedMotion;
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="landing-section-label">
      <div className="landing-section-label-line" aria-hidden />
      <span className="landing-section-label-text">{label}</span>
      <div className="landing-section-label-line landing-section-label-line--grow" aria-hidden />
    </div>
  );
}

function GemDivider() {
  return (
    <div className="landing-gem" aria-hidden>
      <div className="landing-gem-line" />
      <span className="landing-gem-icon">✦</span>
      <div className="landing-gem-line" />
    </div>
  );
}

const GALLERY_LAYOUT_THRESHOLD = 5;

type LandingClientProps = {
  isLoggedIn: boolean;
  featuredImages: FeaturedImageCard[];
};

function landingGalleryLayoutClass(count: number): string {
  if (count <= 0) return "landing-gallery-masonry--empty";
  if (count === 1) return "landing-gallery-masonry--count-1";
  if (count === 2) return "landing-gallery-masonry--count-2";
  if (count < GALLERY_LAYOUT_THRESHOLD) return "landing-gallery-masonry--count-3";
  return "";
}

export function LandingClient({ isLoggedIn, featuredImages }: LandingClientProps) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [heroIn, setHeroIn] = useState(reducedMotion);
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);

  const [problemRef, problemVisible] = useReveal();
  const [howRef, howVisible] = useReveal();
  const [featuresRef, featuresVisible] = useReveal();
  const [galleryRef, galleryVisible] = useReveal();
  const [ctaRef, ctaVisible] = useReveal();

  useEffect(() => {
    if (reducedMotion) {
      queueMicrotask(() => setHeroIn(true));
      return;
    }
    const t = window.setTimeout(() => setHeroIn(true), 100);
    return () => window.clearTimeout(t);
  }, [reducedMotion]);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 40);
    queueMicrotask(() => onScroll());
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const NAV_SCROLL_OFFSET = 72;

  const scrollToSection = useCallback(
    (id: string) => {
      const el = document.getElementById(id);
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY - NAV_SCROLL_OFFSET;
      window.scrollTo({ top, behavior: reducedMotion ? "auto" : "smooth" });
    },
    [reducedMotion],
  );

  const handleJoin = () => {
    if (!email.trim()) return;
    setJoined(true);
  };

  const startHref = isLoggedIn ? "/library" : "/register";
  const joinBetaHref = isLoggedIn ? "/library" : "/register";
  const marqueeItems = [...MARQUEE_TITLES, ...MARQUEE_TITLES];

  const exploreGallery = useCallback(() => {
    try {
      sessionStorage.setItem("novelviz:gallery-scroll-top", "1");
    } catch {
      /* ignore */
    }
    router.push("/gallery");
  }, [router]);

  return (
    <div className="landing-root">
      <div className="landing-glow" aria-hidden />

      <nav
        className={`landing-nav${navScrolled ? " landing-nav--scrolled" : ""}`}
        aria-label="Landing"
      >
        <Link href="/" className="landing-nav-brand">
          <span className="landing-nav-wordmark">NovelViz</span>
        </Link>

        <div className="landing-nav-links">
          <button type="button" className="landing-nav-link" onClick={() => scrollToSection("how-it-works")}>
            How it works
          </button>
          <button type="button" className="landing-nav-link" onClick={() => scrollToSection("features")}>
            Features
          </button>
          <button type="button" className="landing-nav-link" onClick={() => scrollToSection("gallery")}>
            Public Gallery
          </button>
        </div>

        <div className="landing-nav-actions">
          {isLoggedIn ? (
            <Link href="/library" className="landing-nav-signin">
              My Library
            </Link>
          ) : (
            <Link href="/login" className="landing-nav-signin">
              Sign In
            </Link>
          )}
          <Link href={joinBetaHref} className="landing-nav-cta">
            Join Beta →
          </Link>
        </div>
      </nav>

      <section className={`landing-hero${heroIn ? " landing-hero-in" : ""}`}>
        {!reducedMotion ? (
          <DiscoverParticleField count={65} opacity={0.4} linkDistance={90} />
        ) : null}

        <p className="landing-eyebrow">Public Domain · AI Companion · Spoiler-Free</p>

        <h1 className="landing-hero-title">
          Every Chapter,
          <br />
          Alive.
        </h1>

        <p className="landing-hero-sub">
          An AI reading companion that knows only what you&apos;ve read. Ask questions, generate images —
          completely spoiler-free.
        </p>

        <div className="landing-hero-ctas">
          <Link href={startHref} className="landing-btn-primary">
            {isLoggedIn ? "Go to My Library →" : "Start Reading Free →"}
          </Link>
          <Link href="/discover" className="landing-btn-secondary">
            Browse Books
          </Link>
          {!isLoggedIn ? (
            <Link href="/login" className="landing-btn-secondary landing-btn-signin">
              Sign In
            </Link>
          ) : null}
        </div>

        <div className="landing-scroll-cue" aria-hidden>
          <span className="landing-scroll-label">Scroll</span>
          <div className="landing-scroll-line" />
        </div>
      </section>

      <div className="landing-marquee-wrap" aria-hidden>
        <div className="landing-marquee-track">
          {marqueeItems.map((title, i) => (
            <span key={`${title}-${i}`} className="landing-marquee-item">
              {title}
              <span className="landing-marquee-gem">✦</span>
            </span>
          ))}
        </div>
      </div>

      <section
        ref={problemRef}
        className={`landing-section landing-section--narrow landing-reveal${problemVisible ? " landing-reveal--visible" : ""}`}
      >
        <p className="landing-problem-kicker">The Problem</p>
        <blockquote className="landing-blockquote">
          &ldquo;AI assistants are useful for reading — until they casually mention how the story ends.&rdquo;
        </blockquote>
        <p className="landing-body-italic">
          Every other reading AI uses its full knowledge of a book to answer your questions. NovelViz knows
          only what you&apos;ve read so far. Nothing beyond your current chapter ever enters the conversation.
        </p>
      </section>

      <GemDivider />

      <section id="how-it-works" ref={howRef} className="landing-section">
        <SectionLabel label="How it works" />
        <div className="landing-how-grid">
          <div className="landing-steps">
            {STEPS.map((step, i) => (
              <div
                key={step.number}
                className={`landing-step${howVisible ? " landing-step--visible" : ""}`}
                style={howVisible ? { transitionDelay: `${i * 100}ms` } : undefined}
              >
                <div className="landing-step-num">{step.number}</div>
                <div>
                  <h3 className="landing-step-title">{step.title}</h3>
                  <p className="landing-body-italic">{step.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className={`landing-mock-panel${howVisible ? " landing-mock-panel--visible" : ""}`}>
            <div className="landing-mock-card">
              <div className="landing-mock-header">
                <div className="landing-mock-dot" aria-hidden />
                <span className="landing-mock-header-label">Dracula · Chapter 7 of 27</span>
              </div>
              <div className="landing-mock-body">
                <div className="landing-bubble-user">
                  <div className="landing-bubble-user-inner">
                    &ldquo;Why does the Count react so strongly to the crucifix?&rdquo;
                  </div>
                </div>
                <div className="landing-bubble-ai">
                  <div className="landing-bubble-avatar" aria-hidden>
                    📖
                  </div>
                  <div className="landing-bubble-ai-inner">
                    &ldquo;Stoker uses the crucifix as an emblem of sanctified power — a threshold the Count
                    cannot cross. Harker first encounters this in Chapter 3 when he reflexively raises his
                    rosary...&rdquo;
                  </div>
                </div>
                <div className="landing-spoiler-guard">
                  <span aria-hidden>🔒</span>
                  <span className="landing-spoiler-guard-text">Response sealed to Chapter 7 — no spoilers</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <GemDivider />

      <section id="features" ref={featuresRef} className="landing-section">
        <SectionLabel label="Features" />
        <div className="landing-features-grid">
          {PRIMARY_FEATURES.map((feat, i) => (
            <article
              key={feat.title}
              className={`landing-feature-card${featuresVisible ? " landing-feature-card--visible" : ""}`}
              style={featuresVisible ? { transitionDelay: `${i * 100}ms` } : undefined}
            >
              <div className="landing-feature-icon" aria-hidden>
                {feat.icon}
              </div>
              <h3 className="landing-feature-title">{feat.title}</h3>
              <p className="landing-feature-body">{feat.body}</p>
            </article>
          ))}
        </div>

        <div className="landing-features-grid landing-features-grid--secondary">
          {SECONDARY_FEATURES.map(([title, body], i) => (
            <div
              key={title}
              className={`landing-feature-secondary${featuresVisible ? " landing-feature-secondary--visible" : ""}`}
              style={featuresVisible ? { transitionDelay: `${300 + i * 80}ms` } : undefined}
            >
              <h4 className="landing-feature-secondary-title">{title}</h4>
              <p className="landing-feature-secondary-body">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <GemDivider />

      <section id="gallery" ref={galleryRef} className="landing-section">
        <SectionLabel label="Community Gallery" />
        <div className="landing-gallery-intro">
          <h2>Your story, illustrated.</h2>
          <p className="landing-body-italic">
            Readers generate images from the chapters they&apos;ve read. Browse the community gallery — your
            spoiler settings mean you only see scenes you&apos;ve already encountered.
          </p>
        </div>

        <div
          className={`landing-gallery-masonry ${landingGalleryLayoutClass(featuredImages.length)}`.trim()}
        >
          {featuredImages.length === 0 ? (
            <p className="landing-gallery-empty text-sm text-text-secondary">
              Featured community images will appear here as readers create and curators highlight them.
            </p>
          ) : (
            featuredImages.map((item, i) => (
              <div
                key={item.id}
                className={`landing-gallery-item${galleryVisible ? " landing-gallery-item--visible" : ""}`}
                style={galleryVisible ? { transitionDelay: `${i * 70}ms` } : undefined}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.imageUrl} alt={item.userPrompt} loading="lazy" />
                <ImageThumbnailBottomBar />
                <div className="landing-gallery-caption">
                  <div className="landing-gallery-meta">
                    {item.bookTitle} · Ch. {item.chapterNumberAtTime}
                  </div>
                  <div className="landing-gallery-prompt">{item.userPrompt}</div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="landing-gallery-cta-wrap">
          <button type="button" onClick={exploreGallery} className="landing-btn-secondary">
            Explore All Images →
          </button>
        </div>
      </section>

      <section id="beta" ref={ctaRef} className="landing-section landing-beta-section">
        <div className={`landing-beta-card${ctaVisible ? " landing-beta-card--visible" : ""}`}>
          {!reducedMotion ? <DiscoverParticleField count={35} opacity={0.3} linkDistance={90} /> : null}
          <div className="landing-beta-inner">
            <p className="landing-beta-kicker">Now in Beta</p>
            <h2 className="landing-beta-title">Read without fear.</h2>
            <p className="landing-beta-sub">
              Join a small group of readers helping shape NovelViz. Free during beta. No credit card.
            </p>

            {joined ? (
              <p className="landing-beta-success">✦ You&apos;re on the list. We&apos;ll be in touch.</p>
            ) : (
              <div className="landing-beta-form">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  placeholder="your@email.com"
                  className="landing-beta-input"
                  aria-label="Email for beta access"
                />
                <button type="button" className="landing-btn-primary" onClick={handleJoin}>
                  Join →
                </button>
              </div>
            )}

            <p className="landing-beta-fine">Free to use · Public domain books · No credit card</p>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-brand">
          <span className="landing-footer-wordmark">NOVELVIZ</span>
          <span className="landing-footer-copy">© 2026</span>
        </div>
        <nav className="landing-footer-links" aria-label="Footer">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/contact">Contact</Link>
        </nav>
        <p className="landing-footer-tagline">Built for readers, by a reader.</p>
      </footer>
    </div>
  );
}
