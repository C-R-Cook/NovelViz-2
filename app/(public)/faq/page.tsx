import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ | NovelViz",
  description: "Frequently asked questions about NovelViz, spoiler-safe AI, and your library.",
};

type QA = { q: string; a: string };
type Section = { title: string; items: QA[] };

const SECTIONS: Section[] = [
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

export default function FAQPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 text-zinc-900 sm:px-6 sm:py-16 dark:text-zinc-100">
      <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
        Frequently asked questions
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        Everything you need to know about reading with NovelViz — safely and on your terms.
      </p>

      <div className="mt-12 space-y-12">
        {SECTIONS.map((section, si) => (
          <section key={section.title} aria-labelledby={`faq-section-${si}`}>
            <h2
              id={`faq-section-${si}`}
              className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-amber-800 dark:text-amber-200/85"
            >
              {section.title}
            </h2>
            <div className="space-y-3">
              {section.items.map((item) => (
                <details
                  key={item.q}
                  className="group rounded-xl border border-zinc-200/95 bg-white/90 shadow-sm shadow-zinc-900/5 transition-colors open:border-amber-500/55 open:bg-amber-50/40 open:ring-1 open:ring-amber-500/25 dark:border-zinc-800/90 dark:bg-zinc-900/35 dark:shadow-none open:dark:border-amber-600/40 open:dark:bg-zinc-900/60 open:dark:ring-amber-500/20"
                >
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3.5 text-sm font-medium text-zinc-900 outline-none transition marker:content-none [&::-webkit-details-marker]:hidden sm:text-base dark:text-zinc-100">
                    <span className="min-w-0 flex-1">{item.q}</span>
                    <span
                      className="mt-0.5 shrink-0 text-xs text-amber-700 transition-transform duration-200 group-open:rotate-180 dark:text-amber-400/90"
                      aria-hidden
                    >
                      ▼
                    </span>
                  </summary>
                  <div className="border-t border-zinc-200/90 px-4 pb-4 pt-3 text-sm leading-relaxed text-zinc-600 group-open:border-amber-200/80 dark:border-zinc-800/80 dark:text-zinc-400 group-open:dark:border-amber-900/25">
                    {item.a}
                  </div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
