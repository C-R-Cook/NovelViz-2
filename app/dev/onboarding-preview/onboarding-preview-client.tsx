"use client";

import { AuthAfterProvisioning } from "@/app/auth/after/auth-after-provisioning";
import type { CreditPackPriceSummary } from "@/app/(reader)/onboarding/plan/plan-client";
import { PlanClient } from "@/app/(reader)/onboarding/plan/plan-client";
import { PreferencesClient } from "@/app/(reader)/onboarding/preferences/preferences-client";
import type { PublicTierPlan } from "@/lib/tier-limit-config";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import "@/app/(reader)/onboarding/onboarding.css";

const STEPS = [
  { id: "register", label: "Register", title: "Create account" },
  { id: "provisioning", label: "Provisioning", title: "Setting up account" },
  { id: "plan", label: "Plan", title: "Choose your plan" },
  { id: "preferences", label: "Preferences", title: "Your preferences" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

function isStepId(value: string | null): value is StepId {
  return STEPS.some((s) => s.id === value);
}

type Props = {
  initialPlans: PublicTierPlan[];
  creditPack: CreditPackPriceSummary | null;
};
export function OnboardingPreviewClient({ initialPlans, creditPack }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepParam = searchParams.get("step");
  const stepIndex = isStepId(stepParam)
    ? STEPS.findIndex((s) => s.id === stepParam)
    : 0;
  const safeIndex = stepIndex >= 0 ? stepIndex : 0;
  const current = STEPS[safeIndex];

  const goToIndex = useCallback(
    (index: number) => {
      const next = STEPS[Math.max(0, Math.min(index, STEPS.length - 1))];
      router.replace(`/dev/onboarding-preview?step=${next.id}`, { scroll: false });
    },
    [router],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToIndex(safeIndex - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goToIndex(safeIndex + 1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goToIndex, safeIndex]);

  useEffect(() => {
    if (!isStepId(stepParam)) {
      router.replace("/dev/onboarding-preview?step=register", { scroll: false });
    }
  }, [router, stepParam]);

  return (
    <div className="flex min-h-screen flex-col bg-bg-base">
      <div className="sticky top-0 z-50 border-b border-amber-500/40 bg-amber-950/90 px-4 py-2 text-center text-xs text-amber-100 backdrop-blur-sm">
        Design preview — actions won&apos;t save or create accounts (except the Clerk register
        iframe).
      </div>

      <header className="sticky top-[2.25rem] z-40 border-b border-border bg-bg-surface/95 px-4 py-3 backdrop-blur-sm max-sm:top-0 max-sm:static">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">
              Onboarding preview
            </p>
            <p className="text-sm font-medium text-text-primary truncate sm:whitespace-normal">
              Step {safeIndex + 1} of {STEPS.length} — {current.title}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => goToIndex(safeIndex - 1)}
              disabled={safeIndex === 0}
              className="min-h-[2.75rem] rounded-md border border-border bg-bg-raised px-3 py-1.5 text-xs font-medium text-text-primary transition hover:border-accent/50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => goToIndex(safeIndex + 1)}
              disabled={safeIndex === STEPS.length - 1}
              className="min-h-[2.75rem] rounded-md border border-border bg-bg-raised px-3 py-1.5 text-xs font-medium text-text-primary transition hover:border-accent/50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Forward
            </button>
          </div>
        </div>        <div className="mx-auto mt-3 flex max-w-4xl gap-2">
          {STEPS.map((step, i) => (
            <button
              key={step.id}
              type="button"
              onClick={() => goToIndex(i)}
              className={`h-1.5 flex-1 rounded-full transition ${
                i === safeIndex ? "bg-accent" : i < safeIndex ? "bg-accent/40" : "bg-border"
              }`}
              aria-label={`Go to ${step.label}`}
            />
          ))}
        </div>
      </header>

      <div className="onboarding-root flex-1">
        {current.id === "register" ? (
          <iframe
            src="/register"
            className="min-h-[min(100dvh,100vh)] w-full border-0 bg-bg-base sm:min-h-[calc(100vh-8rem)]"
            title="Register preview"
          />
        ) : null}
        {current.id === "provisioning" ? <AuthAfterProvisioning previewMode /> : null}
        {current.id === "plan" ? (
          <PlanClient initialPlans={initialPlans} creditPack={creditPack} previewMode />
        ) : null}
        {current.id === "preferences" ? (
          <PreferencesClient initialName="" showUsernameField previewMode />
        ) : null}
      </div>
    </div>
  );
}
