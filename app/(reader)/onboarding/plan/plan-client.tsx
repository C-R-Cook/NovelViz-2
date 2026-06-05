"use client";

import { completePlanStep } from "@/lib/onboarding-plan-action";
import type { PublicTierPlan } from "@/lib/tier-limit-config";
import Link from "next/link";
import { useCallback, useState } from "react";
import "./plan.css";

type PlanCard = {
  id: "free" | "standard" | "premium";
  name: string;
  price: string;
  betaPrice?: string;
  features: { label: string; value: string }[];
  selectable: boolean;
  comingSoon: boolean;
};

function formatLimit(n: number | null): string {
  return n === null ? "Unlimited" : `${n}/month`;
}

function buildPlanCards(plans: PublicTierPlan[]): PlanCard[] {
  return plans.map((p) => ({
    id: p.tier as PlanCard["id"],
    name: p.name,
    price: p.displayPriceMonthly ?? "—",
    betaPrice: p.tier === "standard" ? "Free during beta" : undefined,
    features: [
      { label: "Q&A", value: formatLimit(p.queriesPerMonth) },
      { label: "Images", value: formatLimit(p.imagesPerMonth) },
      {
        label: "Models",
        value:
          p.allowedModels.length > 1
            ? "All models + early access"
            : "Default only",
      },
    ],
    selectable: p.tier === "free" || p.tier === "standard",
    comingSoon: p.tier === "premium",
  }));
}

type SelectedPlan = "free" | "standard" | "premium" | null;

type Props = {
  initialPlans: PublicTierPlan[];
};

export function PlanClient({ initialPlans }: Props) {
  const plans = buildPlanCards(initialPlans);
  const [selected, setSelected] = useState<SelectedPlan>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitPlan = useCallback(
    async (tier: SelectedPlan, partnerInterest: boolean) => {
      if (!tier) return;
      setError(null);
      setBusy(true);
      try {
        const result = await completePlanStep({ tier, partnerInterest });
        if (!result?.ok) {
          setError(result?.error ?? "Something went wrong. Please try again.");
          return;
        }
        window.location.assign("/onboarding/preferences");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const onGetStarted = useCallback(() => {
    if (!selected || selected === "premium") {
      setError("Please select a plan to continue.");
      return;
    }
    void submitPlan(selected, false);
  }, [selected, submitPlan]);

  const onSelectPlan = useCallback((id: PlanCard["id"]) => {
    setError(null);
    setSelected(id);
  }, []);

  const onPartnerRequest = useCallback(() => {
    setSelected("standard");
    void submitPlan("standard", true);
  }, [submitPlan]);

  return (
    <div className="onboarding-plan px-4">
      <Link href="/" className="onboarding-plan__wordmark">
        NovelViz
      </Link>
      <p className="onboarding-plan__eyebrow">Choose your plan</p>
      <h1 className="onboarding-plan__headline">How would you like to read?</h1>

      <div className="onboarding-plan__cards" role="list">
        {plans.map((plan) => {
          const isSelected = plan.id === selected;
          return (
            <div
              key={plan.id}
              role="listitem"
              aria-selected={plan.selectable ? isSelected : undefined}
              className={`onboarding-plan__card ${
                plan.selectable
                  ? "onboarding-plan__card--selectable"
                  : "onboarding-plan__card--dulled"
              }${isSelected ? " onboarding-plan__card--selected" : ""}`}
              tabIndex={plan.selectable ? 0 : -1}
              onClick={plan.selectable ? () => onSelectPlan(plan.id) : undefined}
              onKeyDown={
                plan.selectable
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectPlan(plan.id);
                      }
                    }
                  : undefined
              }
            >
              {plan.comingSoon ? (
                <span className="onboarding-plan__card-badge">Coming Soon</span>
              ) : null}
              <span className="onboarding-plan__card-tier">{plan.name}</span>
              {plan.id === "standard" && plan.betaPrice ? (
                <>
                  <span className="onboarding-plan__card-price onboarding-plan__card-price--struck">
                    {plan.price}
                  </span>
                  <span className="onboarding-plan__card-beta">{plan.betaPrice}</span>
                </>
              ) : (
                <span className="onboarding-plan__card-price">{plan.price}</span>
              )}
              <ul className="onboarding-plan__card-features">
                {plan.features.map((f) => (
                  <li key={f.label}>
                    <span>{f.label}</span>
                    <strong>{f.value}</strong>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="onboarding-plan__divider" aria-hidden>
        <span className="onboarding-plan__divider-line" />
        <span>✦</span>
        <span className="onboarding-plan__divider-line" />
      </div>

      <div className="onboarding-plan__partner">
        <p className="onboarding-plan__partner-text">
          Want to list your books on NovelViz? Partner accounts are for authors and publishers.
          Request access and we&apos;ll be in touch.
        </p>
        <button
          type="button"
          className="onboarding-plan__partner-cta"
          disabled={busy}
          onClick={onPartnerRequest}
        >
          Request Partner Access
        </button>
      </div>

      <p className="onboarding-plan__beta-note">
        During beta all accounts can use Standard features at no charge. After beta, accounts return to
        their selected tier and you can upgrade anytime.
      </p>

      <div className="onboarding-plan__actions">
        <button
          type="button"
          className="onboarding-plan__primary"
          disabled={busy || !selected || selected === "premium"}
          onClick={onGetStarted}
        >
          {busy ? "Continuing…" : "Get started"}
        </button>
      </div>

      {error ? (
        <p className="onboarding-plan__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
