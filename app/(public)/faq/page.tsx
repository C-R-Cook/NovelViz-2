/**
 * FAQ page — static copy only (no database, no API).
 *
 * HOW TO EDIT CONTENT
 * ---------------------
 * 1. Scroll to `SECTIONS` below. That array is the entire FAQ.
 * 2. Page order = array order: first section appears at the top, last at the bottom.
 * 3. To add a **section**: push `{ title: "Your heading", items: [...] }`. Optionally add `id: "anchor-slug"`
 *    so you can link to it as `/faq#anchor-slug` (see **Publisher partnership**).
 * 4. To add a **question** inside a section: add `{ q: "…", a: "…" }` to that section’s `items`.
 *    - `q` = question shown in the accordion header (keep it unique; it’s also the React `key`).
 *    - `a` = answer shown when expanded (plain text; use \n for line breaks if you ever need them).
 * 5. To **remove** something: delete that section object or that `{ q, a }` entry.
 * 6. To **reorder**: move whole section objects, or move lines inside `items`.
 *
 * HOW TO EDIT LAYOUT / STYLES
 * ----------------------------
 * - Page shell (title, intro): see `FAQPage` return at the bottom.
 * - Accordion look (borders, gold when open): see `ACCORDION_*` constants — change once, applies everywhere.
 * - Section headings (small caps, amber): see `SECTION_HEADING_CLASS` on the `<h2>`.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ | NovelViz",
  description: "Frequently asked questions about NovelViz, spoiler-safe AI, and your library.",
};

/** Single FAQ row: question (summary) + answer (expanded body). */
type FAQItem = { q: string; a: string };

/** One block on the page: a section title + any number of accordion items. */
type FAQSection = { title: string; items: FAQItem[]; /** Optional anchor for links (e.g. `/faq#publisher-partnership`). */ id?: string };

// --- Accordion styling (native `<details>` / `<summary>`). Gold accent when open. ---

/* Each string is one literal so Tailwind’s scanner keeps every utility class. */
const ACCORDION_DETAILS_CLASS =
  "group rounded-xl border border-border/95 bg-bg-surface/90 shadow-sm shadow-bg-overlay/5 transition-colors open:border-accent/55 open:bg-accent-muted open:ring-1 open:ring-accent/25   ";

const ACCORDION_SUMMARY_CLASS =
  "flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3.5 text-sm font-medium text-text-primary outline-none transition marker:content-none [&::-webkit-details-marker]:hidden sm:text-base";

const ACCORDION_CHEVRON_CLASS =
  "mt-0.5 shrink-0 text-xs text-warning transition-transform duration-200 group-open:rotate-180";

const ACCORDION_ANSWER_CLASS =
  "border-t border-border px-4 pb-4 pt-3 text-sm leading-relaxed text-text-muted group-open:border-accent/30 group-";

const SECTION_HEADING_CLASS =
  "mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-accent-text";

// --- All FAQ content: edit here only (unless you add new layout above). ---

const SECTIONS: FAQSection[] = [
  // ----- About NovelViz -----
  {
    title: "About NovelViz",
    items: [
      {
        q: "What is NovelViz?",
        a: "NovelViz is an AI-powered reading companion that lets you ask questions about books and generate images from scenes and characters — all strictly limited to content you've already read. No spoilers, ever.",
      },
      {
        q: "How does the spoiler protection work?",
        a: "When you set your current chapter, every AI interaction is gated to only use content from chapters you've reached. Claude cannot reference anything beyond your current chapter, even if it knows the story.",
      },
      {
        q: "Do I need to own the book to use NovelViz?",
        a: "Yes — NovelViz is a companion to books you already own in the real world. You tell us which book you own and where you are in it. We provide the intelligence layer on top of that.",
      },
    ],
  },

  // ----- Using NovelViz -----
  {
    title: "Using NovelViz",
    items: [
      {
        q: "How do I add a book to my library?",
        a: "Browse the Discover page, click on a book, and click Start Reading. The book is added to your library automatically.",
      },
      {
        q: "How do I set my reading progress?",
        a: "On the reader page for any book, use the chapter selector to set which chapter you're currently on and click Save Progress.",
      },
      {
        q: "How accurate are the AI answers?",
        a: "Claude answers using only text from the book up to your current chapter. If something hasn't been mentioned yet, it will tell you rather than making something up.",
      },
      {
        q: "Can I generate images of any scene?",
        a: "You can generate images of characters, locations, objects and scenes — but only from content you've already read. The AI draws visual details directly from the book's descriptions.",
      },
    ],
  },

  // ----- About the Images -----
  {
    title: "About the Images",
    items: [
      {
        q: "Why do the generated images look different from the film or TV adaptation I know?",
        a: "NovelViz generates images directly from the author's original descriptions in the book — not from any film, TV show, or other adaptation. This means you're seeing the story as the author imagined it, which is often quite different from how it's been portrayed on screen. We think that's part of the magic.",
      },
      {
        q: "Why does the same character look different in different images?",
        a: "Each image is generated independently using descriptions from the book text. While we work hard to extract accurate visual details, character appearance can vary between generations. Consistent character appearance across multiple images is something we're actively improving.",
      },
      {
        q: "Can I generate images from any scene?",
        a: "You can generate images of any character, location, object, or moment — but only from content you've already read. The AI draws visual details directly from the book's descriptions up to your current chapter. Anything beyond where you are in the story is strictly off limits.",
      },
    ],
  },

  // ----- Books & Content -----
  {
    title: "Books & Content",
    items: [
      {
        q: "Why isn't my book available?",
        a: "NovelViz currently features public domain classics. We're actively working with publishers and authors to expand the catalogue. You can request a book from the Discover page.",
      },
      {
        q: "How do I request a book?",
        a: "Use the book request form on the Discover page. We pass real demand data to publishers to help prioritise new additions.",
      },
      {
        q: "Are the books free to read on NovelViz?",
        a: "NovelViz is not an ebook reader — you won't find the book text here. We provide AI features for books you already own.",
      },
    ],
  },

  // ----- Publisher partnership -----
  {
    id: "publisher-partnership",
    title: "Publisher partnership",
    items: [
      {
        q: "How do readers discover my books?",
        a: "We can feature your work to a highly targeted audience of people who are already deep in a reading experience. Discovery feels natural — readers never get the sense that they are being served an advertisement.",
      },
      {
        q: "Can we link to where readers buy the book?",
        a: "Yes. You can point readers to retailers, your press page, or anywhere you sell — so the path from curiosity to purchase stays clear.",
      },
      {
        q: "What does it cost to partner with NovelViz?",
        a: "Free for partners, always.",
      },
      {
        q: "Can users read my book on your site?",
        a: "No. NovelViz is not a place to read a full book the way you would on a free ebook site. Readers use it as a spoiler-safe companion—chapter-aware questions, images, and help—while they read the copy they already bought or borrowed. Your listing connects engaged readers with your work; it does not replace your retail channels or put the complete text out for casual browsing.",
      },
      {
        q: "How is my book stored and used to generate answers and images?",
        a: "When a partner title goes live, the manuscript is split into many small, labelled segments by chapter—we call those chunks—and stored in our database. We also build embeddings (compact numeric fingerprints) that help the system find the right passage when a reader asks something. Each time someone gets an answer or an image, only the chunks from chapters they have already reached are used for that request. The material stays inside NovelViz’s systems to run those features for logged-in readers; it is not presented as a browsable book, and readers cannot read ahead of their saved progress.",
      },
    ],
  },

  // ----- Account & Privacy -----
  {
    title: "Account & Privacy",
    items: [
      {
        q: "Is my reading data private?",
        a: "Yes. Your reading progress, questions, and generated images are private by default. You choose what to share to the public gallery.",
      },
      {
        q: "How do I delete my account?",
        a: "You can delete your account from your account settings page. This permanently removes all your data.",
      },
      {
        q: "Is NovelViz free?",
        a: "NovelViz offers a free tier with core features. Premium plans with additional image generations and features are coming soon.",
      },
    ],
  },
];

/**
 * Renders the static FAQ: loops `SECTIONS` and builds one `<section>` per block,
 * each containing native `<details>` accordions (no extra client JS).
 */
export default function FAQPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 text-text-primary sm:px-6 sm:py-16">
      <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
        Frequently asked questions
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-text-secondary">
        Everything you need to know about reading with NovelViz — safely and on your terms.
      </p>

      <div className="mt-12 space-y-12">
        {SECTIONS.map((section, sectionIndex) => (
          <section
            key={section.title}
            id={section.id}
            aria-labelledby={`faq-section-${sectionIndex}`}
          >
            <h2 id={`faq-section-${sectionIndex}`} className={SECTION_HEADING_CLASS}>
              {section.title}
            </h2>
            <div className="space-y-3">
              {section.items.map((item) => (
                <details key={item.q} className={ACCORDION_DETAILS_CLASS}>
                  <summary className={ACCORDION_SUMMARY_CLASS}>
                    <span className="min-w-0 flex-1">{item.q}</span>
                    <span className={ACCORDION_CHEVRON_CLASS} aria-hidden>
                      ▼
                    </span>
                  </summary>
                  <div className={ACCORDION_ANSWER_CLASS}>{item.a}</div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
