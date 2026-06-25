"use client";

import { LegalConsentSubmitForm } from "@/components/auth/sign-up-legal-consent";
import { useRouter } from "next/navigation";

export function AuthConsentClient() {
  const router = useRouter();

  return (
    <div className="w-full max-w-md rounded-xl border border-border bg-bg-surface/90 p-6 shadow-sm">
      <h1 className="font-serif text-2xl font-semibold tracking-tight text-text-primary">
        Confirm your agreements
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        To use NovelViz, please confirm that you are 18 or older and that you agree to our Terms of
        Service and Privacy Policy. We record the date and time of your confirmation.
      </p>
      <div className="mt-6">
        <LegalConsentSubmitForm
          submitLabel="Continue to NovelViz"
          onSuccess={() => {
            router.replace("/auth/after");
            router.refresh();
          }}
        />
      </div>
    </div>
  );
}
