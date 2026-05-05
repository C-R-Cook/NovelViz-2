import { ContactBlock } from "./contact-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact | NovelViz",
  description: "Get in touch with NovelViz — general enquiries, support, partnerships, and more.",
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-12 text-text-primary sm:px-6 sm:py-16">
      <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">Contact us</h1>
      <p className="mt-3 text-sm leading-relaxed text-text-secondary">
        Send a message and we&apos;ll respond as soon as we can.
      </p>
      <div className="mt-10">
        <ContactBlock />
      </div>
    </div>
  );
}
