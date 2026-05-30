"use client";

import { completePlanStep } from "@/lib/onboarding-plan-action";
import Link from "next/link";
import { useCallback, useState } from "react";
import "./plan.css";

const PLANS = [
  {
    id: "free" as const,
    name: "Free",
    price: "Free",
    features: [
      { label: "Q&A", value: "50/month" },
      { label: "Images", value: "5/month" },
      { label: "Models", value: "Default only" },
    ],
    selectable: false,
    comingSoon: true,
  },
  {
    id: "standard" as const,
    name: "Standard",
    price: "$5/mo",
    betaPrice: "Free during beta",
    features: [
      { label: "Q&A", value: "Unlimited" },
      { label: "Images", value: "50/month" },
      { label: "Models", value: "Default only" },
    ],
    selectable: true,
    comingSoon: false,
  },
  {
    id: "premium" as const,
    name: "Premium",
    price: "$10/mo",
    features: [
      { label: "Q&A", value: "Unlimited" },
      { label: "Images", value: "120/month" },
      { label: "Models", value: "All models + early access" },
    ],
    selectable: false,
    comingSoon: true,
  },
] as const;

type SelectedPlan = "standard" | null;

export function PlanClient() {
  const [selected, setSelected] = useState<SelectedPlan>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitPlan = useCallback(async (partnerInterest: boolean) => {
    setError(null);
    setBusy(true);
    try {
      const result = await completePlanStep({
        tier: "standard",
        partnerInterest,
      });
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
  }, []);

  const onGetStarted = useCallback(() => {
    if (selected !== "standard") {
      setError("Please select the Standard plan to continue.");
      return;
    }
    void submitPlan(false);
  }, [selected, submitPlan]);

  const onSelectStandard = useCallback(() => {
    setError(null);
    setSelected("standard");
  }, []);

  const onPartnerRequest = useCallback(() => {
    setSelected("standard");
    void submitPlan(true);
  }, [submitPlan]);

  return (
    <div className="onboarding-plan px-4">
      <Link href="/" className="onboarding-plan__wordmark">
        NovelViz
      </Link>
      <p className="onboarding-plan__eyebrow">Choose your plan</p>
      <h1 className="onboarding-plan__headline">How would you like to read?</h1>

      <div className="onboarding-plan__cards" role="list">
        {PLANS.map((plan) => {
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
              onClick={plan.selectable ? onSelectStandard : undefined}
              onKeyDown={
                plan.selectable
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectStandard();
                      }
                    }
                  : undefined
              }
            >
              {plan.comingSoon ? (
                <span className="onboarding-plan__card-badge">Coming Soon</span>
              ) : null}
              <span className="onboarding-plan__card-tier">{plan.name}</span>
              {plan.id === "standard" ? (
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
        During beta all accounts are on Standard at no charge. After beta, accounts return to the
        free tier and you can choose to upgrade.
      </p>

      <div className="onboarding-plan__actions">
        <button
          type="button"
          className="onboarding-plan__primary"
          disabled={busy || selected !== "standard"}
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
