"use client";

import { completePlanStep } from "@/lib/onboarding-plan-action";
import type { PublicTierPlan } from "@/lib/tier-limit-config";
import { useCallback, useMemo, useState } from "react";
import "./plan.css";

type PlanId = "free" | "standard" | "premium" | "partner";

type CtaStyle = "ghost" | "outline" | "disabled";

type PlanCardModel = {
  id: PlanId;
  name: string;
  priceDisplay: string | null;
  priceSubtext: string | null;
  features: { label: string; value: string; muted?: boolean }[];
  cta: string;
  ctaStyle: CtaStyle;
  ribbon: string | null;
  disabled: boolean;
  isPartner?: boolean;
};

export type CreditPackPriceSummary = {
  priceFree: number;
  priceStandard: number;
  pricePremium: number;
};

function formatLimit(n: number | null): string {
  return n === null ? "Unlimited" : `${n} / month`;
}

function formatMonthlyPrice(price: string | null): string | null {
  if (!price) return null;
  if (/\//.test(price)) return price;
  return `${price} / mo`;
}

function formatExtraTokens(
  tier: "free" | "standard" | "premium",
  creditPurchasesEnabled: boolean,
  creditPack: CreditPackPriceSummary | null,
): string {
  if (!creditPurchasesEnabled) return "N/A";
  if (!creditPack) return "Available";
  const cents =
    tier === "premium"
      ? creditPack.pricePremium
      : tier === "standard"
        ? creditPack.priceStandard
        : creditPack.priceFree;
  if (cents <= 0) return "Available";
  return `$${(cents / 100).toFixed(2)} / pack`;
}

function buildReaderPlanCards(
  plans: PublicTierPlan[],
  creditPack: CreditPackPriceSummary | null,
): PlanCardModel[] {
  return plans.map((p) => {
    const tier = p.tier as "free" | "standard" | "premium";
    const isPremium = tier === "premium";
    const monthly = formatMonthlyPrice(p.displayPriceMonthly);

    return {
      id: tier,
      name: p.name,
      priceDisplay:
        tier === "free" ? "Free" : monthly,
      priceSubtext: tier === "standard" ? "Free during beta" : null,
      features: [
        { label: "Q&A", value: formatLimit(p.queriesPerMonth) },
        { label: "Images", value: formatLimit(p.imagesPerMonth) },
        {
          label: "Models",
          value:
            p.allowedModels.length > 1 ? "All + early access" : "Default only",
        },
        {
          label: "Extra tokens",
          value: formatExtraTokens(tier, p.creditPurchasesEnabled, creditPack),
          muted: !p.creditPurchasesEnabled,
        },
      ],
      cta: isPremium ? "Coming Soon" : tier === "free" ? "Start for free" : "Choose Standard",
      ctaStyle: isPremium ? "disabled" : "ghost",
      ribbon: isPremium ? "COMING SOON" : null,
      disabled: isPremium,
    };
  });
}

const PARTNER_PLAN: PlanCardModel = {
  id: "partner",
  name: "Partner",
  priceDisplay: "By application",
  priceSubtext: "Includes Standard reader account",
  features: [
    { label: "Book uploads", value: "Unlimited" },
    { label: "Reader analytics", value: "Included" },
    { label: "Affiliate links", value: "Included" },
    { label: "Reader account", value: "Standard tier" },
  ],
  cta: "Request access",
  ctaStyle: "outline",
  ribbon: null,
  disabled: false,
  isPartner: true,
};

type Props = {
  initialPlans: PublicTierPlan[];
  creditPack?: CreditPackPriceSummary | null;
  previewMode?: boolean;
};

type PlanCardProps = {
  plan: PlanCardModel;
  isSelected: boolean;
  busy: boolean;
  onSelect: () => void;
  onCta: () => void;
};

function PlanCard({ plan, isSelected, busy, onSelect, onCta }: PlanCardProps) {
  return (
    <div
      role="listitem"
      aria-selected={!plan.disabled ? isSelected : undefined}
      className={[
        "onboarding-plan__card",
        isSelected ? "onboarding-plan__card--selected" : "",
        plan.isPartner ? "onboarding-plan__card--partner" : "",
        plan.disabled ? "onboarding-plan__card--disabled" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      tabIndex={plan.disabled ? -1 : 0}
      onClick={plan.disabled ? undefined : onSelect}
      onKeyDown={
        plan.disabled
          ? undefined
          : (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect();
              }
            }
      }
    >
      {plan.ribbon ? (
        <div className="onboarding-plan__ribbon onboarding-plan__ribbon--muted">
          <span className="onboarding-plan__ribbon-text">{plan.ribbon}</span>
        </div>
      ) : null}

      {isSelected ? <div className="onboarding-plan__selected-glow" aria-hidden /> : null}

      <div className="onboarding-plan__plan-name-row">
        <span
          className={[
            "onboarding-plan__plan-name",
            plan.isPartner ? "onboarding-plan__plan-name--partner" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {plan.name}
        </span>
        {plan.isPartner ? (
          <span className="onboarding-plan__partner-badge">Authors &amp; publishers</span>
        ) : null}
      </div>

      <div className="onboarding-plan__price-row">
        {plan.id === "free" ? (
          <span className="onboarding-plan__price-free">{plan.priceDisplay}</span>
        ) : null}
        {plan.id !== "free" && plan.id !== "partner" && plan.priceDisplay ? (
          <span className="onboarding-plan__price-struck">{plan.priceDisplay}</span>
        ) : null}
        {plan.isPartner && plan.priceDisplay ? (
          <span className="onboarding-plan__price-by-app">{plan.priceDisplay}</span>
        ) : null}
        {plan.priceSubtext ? (
          <span
            className={[
              "onboarding-plan__price-subtext",
              plan.id === "standard" ? "onboarding-plan__price-subtext--gold" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {plan.priceSubtext}
          </span>
        ) : null}
      </div>

      <div className="onboarding-plan__divider" aria-hidden />

      <div className="onboarding-plan__features">
        {plan.features.map((feature) => (
          <div key={feature.label} className="onboarding-plan__feature-row">
            <span className="onboarding-plan__feature-label">{feature.label}</span>
            <span
              className={[
                "onboarding-plan__feature-value",
                feature.muted ? "onboarding-plan__feature-value--muted" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {feature.value}
            </span>
          </div>
        ))}
      </div>

      {plan.isPartner ? (
        <p className="onboarding-plan__partner-note">
          Upgrade your reader account anytime after approval.
        </p>
      ) : null}

      <button
        type="button"
        className={[
          "onboarding-plan__cta",
          plan.ctaStyle === "ghost" ? "onboarding-plan__cta--ghost" : "",
          plan.ctaStyle === "outline" ? "onboarding-plan__cta--outline" : "",
          plan.ctaStyle === "disabled" ? "onboarding-plan__cta--disabled" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        disabled={plan.disabled || busy}
        onClick={(e) => {
          e.stopPropagation();
          onCta();
        }}
      >
        {busy && !plan.disabled ? "Continuing…" : plan.cta}
      </button>
    </div>
  );
}

export function PlanClient({
  initialPlans,
  creditPack = null,
  previewMode = false,
}: Props) {
  const plans = useMemo(
    () => [...buildReaderPlanCards(initialPlans, creditPack), PARTNER_PLAN],
    [initialPlans, creditPack],
  );
  const [selected, setSelected] = useState<PlanId>("standard");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitPlan = useCallback(
    async (tier: "free" | "standard" | "premium", partnerInterest: boolean) => {
      setError(null);
      if (previewMode) return;
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
    [previewMode],
  );

  const handleCta = useCallback(
    (id: PlanId) => {
      if (id === "premium") return;
      if (id === "partner") {
        setSelected("partner");
        void submitPlan("standard", true);
        return;
      }
      setSelected(id);
      void submitPlan(id, false);
    },
    [submitPlan],
  );

  const handleSelect = useCallback((id: PlanId) => {
    const plan = plans.find((p) => p.id === id);
    if (!plan || plan.disabled) return;
    setError(null);
    setSelected(id);
  }, [plans]);

  return (
    <div className="onboarding-plan">
      <header className="onboarding-plan__header">
        <span className="onboarding-plan__eyebrow">Choose your plan</span>
        <h1 className="onboarding-plan__headline">How would you like to read?</h1>
      </header>

      <div className="onboarding-plan__cards" role="list">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isSelected={selected === plan.id}
            busy={busy}
            onSelect={() => handleSelect(plan.id)}
            onCta={() => handleCta(plan.id)}
          />
        ))}
      </div>

      <p className="onboarding-plan__footer-note">
        During beta all accounts access Standard features at no charge. After beta, accounts revert
        to the Free tier — you can upgrade anytime.
      </p>

      {error ? (
        <p className="onboarding-plan__error" role="alert">
          {error}
        </p>
      ) : null}
      {previewMode ? (
        <p className="onboarding-plan__preview-note">
          Preview — use the toolbar above to continue to the next step.
        </p>
      ) : null}
    </div>
  );
}
