import { useState } from "react";

const plans = [
  {
    id: "free",
    name: "Free",
    price: null,
    priceDisplay: "Free",
    priceSubtext: null,
    features: [
      { label: "Q&A", value: "50 / month" },
      { label: "Images", value: "5 / month" },
      { label: "Models", value: "Default only" },
      { label: "Extra tokens", value: "N/A" },
    ],
    cta: "Start for free",
    ctaStyle: "ghost",
    ribbon: null,
    dimmed: false,
    disabled: false,
  },
  {
    id: "standard",
    name: "Standard",
    price: "$5",
    priceDisplay: "$5 / mo",
    priceSubtext: "Free during beta",
    features: [
      { label: "Q&A", value: "Unlimited" },
      { label: "Images", value: "50 / month" },
      { label: "Models", value: "Default only" },
      { label: "Extra tokens", value: "$1.99 / pack" },
    ],
    cta: "Choose Standard",
    ctaStyle: "ghost",
    ribbon: null,
    ribbonStyle: null,
    dimmed: false,
    disabled: false,
  },
  {
    id: "premium",
    name: "Premium",
    price: "$10",
    priceDisplay: "$10 / mo",
    priceSubtext: null,
    features: [
      { label: "Q&A", value: "Unlimited" },
      { label: "Images", value: "120 / month" },
      { label: "Models", value: "All + early access" },
      { label: "Extra tokens", value: "$1.49 / pack" },
    ],
    cta: "Coming Soon",
    ctaStyle: "disabled",
    ribbon: "COMING SOON",
    ribbonStyle: "muted",
    dimmed: false,
    disabled: true,
  },
  {
    id: "partner",
    name: "Partner",
    price: null,
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
    dimmed: false,
    disabled: false,
    isPartner: true,
  },
];

export default function PlanPicker() {
  const [selected, setSelected] = useState("standard");

  return (
    <div style={styles.root}>
      {/* Ambient glow */}
      <div style={styles.glow} />

      {/* Header */}
      <div style={styles.header}>
        <span style={styles.eyebrow}>CHOOSE YOUR PLAN</span>
        <h1 style={styles.headline}>How would you like to read?</h1>
      </div>

      {/* Cards grid */}
      <div style={styles.grid}>
        {plans.map((plan) => {
          const isSelected = selected === plan.id && !plan.disabled;
          return (
            <PlanCard
              key={plan.id}
              plan={plan}
              isSelected={isSelected}
              onSelect={() => !plan.disabled && setSelected(plan.id)}
            />
          );
        })}
      </div>

      {/* Footer note */}
      <p style={styles.footerNote}>
        During beta all accounts access Standard features at no charge. After beta, accounts revert to the Free tier — you can upgrade anytime.
      </p>

      <style>{css}</style>
    </div>
  );
}

function PlanCard({ plan, isSelected, onSelect }) {
  const cardStyle = {
    ...styles.card,
    ...(isSelected ? styles.cardSelected : {}),
    ...(plan.dimmed ? styles.cardDimmed : {}),
    ...(plan.isPartner ? styles.cardPartner : {}),
    cursor: plan.disabled ? "default" : "pointer",
  };

  return (
    <div style={cardStyle} onClick={onSelect} className={`plan-card${isSelected ? " selected" : ""}${plan.dimmed ? " dimmed" : ""}`}>
      {/* Ribbon */}
      {plan.ribbon && (
        <div style={{
          ...styles.ribbon,
          ...(plan.ribbonStyle === "gold" ? styles.ribbonGold : styles.ribbonMuted),
        }}>
          <span style={styles.ribbonText}>{plan.ribbon}</span>
        </div>
      )}

      {/* Selected glow */}
      {isSelected && <div style={styles.selectedGlow} />}

      {/* Plan name */}
      <div style={styles.planNameRow}>
        <span style={{
          ...styles.planName,
          ...(plan.isPartner ? styles.planNamePartner : {}),
          ...(plan.dimmed ? styles.planNameDimmed : {}),
        }}>
          {plan.name}
        </span>
        {plan.isPartner && <span style={styles.partnerBadge}>AUTHORS & PUBLISHERS</span>}
      </div>

      {/* Price */}
      <div style={styles.priceRow}>
        {plan.price && (
          <span style={styles.priceStruck}>{plan.priceDisplay}</span>
        )}
        {!plan.price && !plan.isPartner && (
          <span style={styles.priceFree}>{plan.priceDisplay}</span>
        )}
        {plan.isPartner && (
          <span style={styles.priceByApp}>{plan.priceDisplay}</span>
        )}
        {plan.priceSubtext && (
          <span style={{
            ...styles.priceSubtext,
            ...(plan.id === "standard" ? styles.priceSubtextGold : {}),
          }}>
            {plan.priceSubtext}
          </span>
        )}
      </div>

      {/* Divider */}
      <div style={styles.divider} />

      {/* Features */}
      <div style={styles.features}>
        {plan.features.map((f) => (
          <div key={f.label} style={styles.featureRow}>
            <span style={styles.featureLabel}>{f.label}</span>
            <span style={{
              ...styles.featureValue,
              ...(f.value === "N/A" ? styles.featureNA : {}),
              ...(plan.dimmed ? styles.featureValueDimmed : {}),
            }}>
              {f.value}
            </span>
          </div>
        ))}
      </div>

      {/* Partner upgrade note — above CTA */}
      {plan.isPartner && (
        <p style={styles.partnerNote}>
          Upgrade your reader account anytime after approval.
        </p>
      )}

      {/* CTA */}
      <button
        style={{
          ...styles.cta,
          ...(plan.ctaStyle === "accent" ? styles.ctaAccent : {}),
          ...(plan.ctaStyle === "ghost" ? styles.ctaGhost : {}),
          ...(plan.ctaStyle === "outline" ? styles.ctaOutline : {}),
          ...(plan.ctaStyle === "disabled" ? styles.ctaDisabled : {}),
        }}
        disabled={plan.disabled}
        onClick={(e) => { e.stopPropagation(); }}
        className="plan-cta"
      >
        {plan.cta}
      </button>
    </div>
  );
}

const styles = {
  root: {
    minHeight: "100vh",
    background: "var(--bg-base, #0e0c08)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "3rem 1.5rem 4rem",
    position: "relative",
    fontFamily: "'Cormorant Garamond', 'Georgia', serif",
    color: "var(--text-primary, #e8dfc8)",
  },
  glow: {
    position: "fixed",
    top: 0, left: 0, right: 0, bottom: 0,
    background: "radial-gradient(ellipse 60% 35% at 50% 0%, rgba(196,154,60,0.12), transparent 70%)",
    pointerEvents: "none",
    zIndex: 0,
  },
  header: {
    textAlign: "center",
    marginBottom: "2.5rem",
    position: "relative",
    zIndex: 1,
  },
  eyebrow: {
    fontFamily: "'DM Mono', 'Courier New', monospace",
    fontSize: "10px",
    letterSpacing: "4px",
    color: "var(--text-muted, #7a6e56)",
    display: "block",
    marginBottom: "0.75rem",
  },
  headline: {
    fontFamily: "'Cormorant Garamond', 'Georgia', serif",
    fontSize: "clamp(2rem, 5vw, 3.25rem)",
    fontWeight: 300,
    letterSpacing: "-0.01em",
    margin: 0,
    background: "linear-gradient(135deg, var(--text-primary, #e8dfc8) 0%, var(--highlight, #C49A3C) 50%, var(--text-primary, #e8dfc8) 100%)",
    backgroundSize: "200% auto",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    animation: "shimmer 7s linear infinite",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "1rem",
    width: "100%",
    maxWidth: "1100px",
    position: "relative",
    zIndex: 1,
  },

  card: {
    position: "relative",
    background: "var(--bg-surface, #16140f)",
    border: "1px solid var(--border-subtle, #2a2518)",
    borderRadius: "14px",
    padding: "1.75rem 1.5rem 1.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "0",
    minHeight: "420px",
    overflow: "hidden",
    transition: "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.25s, box-shadow 0.25s",
  },
  cardSelected: {
    border: "1px solid var(--accent, #C49A3C)",
    boxShadow: "0 0 0 1px var(--accent, #C49A3C), 0 8px 40px rgba(196,154,60,0.18)",
    background: "radial-gradient(ellipse 100% 60% at 50% 0%, rgba(196,154,60,0.07), var(--bg-surface, #16140f) 65%)",
  },
  cardDimmed: {
    // content muted via planNameDimmed and featureValue colours — card itself stays full opacity
  },
  cardPartner: {
    border: "1px solid var(--border-default, #3a3020)",
    background: "var(--bg-elevated, #1c1a12)",
  },

  selectedGlow: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: "1px",
    background: "linear-gradient(90deg, transparent, var(--accent, #C49A3C), transparent)",
  },

  // Ribbon — corner banner style
  ribbon: {
    position: "absolute",
    top: "14px",
    right: "-28px",
    width: "120px",
    padding: "4px 0",
    transform: "rotate(35deg)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  ribbonGold: {
    background: "var(--accent, #C49A3C)",
  },
  ribbonMuted: {
    background: "#4a4232",
  },
  ribbonText: {
    fontFamily: "'DM Mono', 'Courier New', monospace",
    fontSize: "7px",
    letterSpacing: "1.5px",
    color: "#c8b87a",
    fontWeight: 600,
  },

  planNameRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.5rem",
    flexWrap: "wrap",
    marginBottom: "0.6rem",
  },
  planName: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: "1.6rem",
    fontWeight: 600,
    color: "var(--text-primary, #e8dfc8)",
    lineHeight: 1,
  },
  planNamePartner: {
    color: "var(--highlight, #C49A3C)",
  },
  planNameDimmed: {
    color: "var(--text-muted, #7a6e56)",
  },
  partnerBadge: {
    fontFamily: "'DM Mono', monospace",
    fontSize: "7px",
    letterSpacing: "1.5px",
    color: "var(--text-muted, #7a6e56)",
    border: "1px solid var(--border-subtle, #2a2518)",
    borderRadius: "4px",
    padding: "3px 6px",
    marginTop: "4px",
    whiteSpace: "nowrap",
  },

  priceRow: {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    marginBottom: "1.25rem",
    minHeight: "52px",
  },
  priceStruck: {
    fontFamily: "'DM Mono', monospace",
    fontSize: "0.9rem",
    color: "var(--text-muted, #7a6e56)",
    textDecoration: "line-through",
  },
  priceFree: {
    fontFamily: "'DM Mono', monospace",
    fontSize: "0.9rem",
    color: "var(--text-secondary, #b8a880)",
  },
  priceByApp: {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: "1rem",
    fontStyle: "italic",
    color: "var(--text-secondary, #b8a880)",
  },
  priceSubtext: {
    fontFamily: "'DM Mono', monospace",
    fontSize: "0.75rem",
    color: "var(--text-muted, #7a6e56)",
  },
  priceSubtextGold: {
    color: "var(--accent, #C49A3C)",
  },

  divider: {
    height: "1px",
    background: "var(--border-subtle, #2a2518)",
    marginBottom: "1.1rem",
  },

  features: {
    display: "flex",
    flexDirection: "column",
    gap: "0.55rem",
    flex: 1,
    marginBottom: "1.5rem",
  },
  featureRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "0.5rem",
  },
  featureLabel: {
    fontFamily: "'DM Mono', monospace",
    fontSize: "0.72rem",
    color: "var(--text-muted, #7a6e56)",
    letterSpacing: "0.5px",
  },
  featureValue: {
    fontFamily: "'DM Mono', monospace",
    fontSize: "0.72rem",
    color: "var(--text-secondary, #b8a880)",
    fontWeight: 600,
    textAlign: "right",
  },
  featureValueDimmed: {
    color: "var(--text-muted, #7a6e56)",
    fontWeight: 400,
  },
  featureNA: {
    color: "var(--text-muted, #7a6e56)",
    fontWeight: 400,
  },

  cta: {
    width: "100%",
    padding: "0.7rem 1rem",
    borderRadius: "8px",
    fontFamily: "'DM Mono', monospace",
    fontSize: "0.72rem",
    letterSpacing: "1.5px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    border: "none",
    textTransform: "uppercase",
  },
  ctaAccent: {
    background: "var(--accent, #C49A3C)",
    color: "#0e0c08",
    fontWeight: 700,
  },
  ctaGhost: {
    background: "transparent",
    color: "#b8a880",
    border: "1px solid #3a3020",
  },
  ctaOutline: {
    background: "rgba(196,154,60,0.08)",
    color: "#C49A3C",
    border: "1px solid #C49A3C",
  },
  ctaDisabled: {
    background: "var(--border-subtle, #2a2518)",
    color: "var(--text-muted, #7a6e56)",
    cursor: "default",
  },

  partnerNote: {
    fontFamily: "'Cormorant Garamond', serif",
    fontStyle: "italic",
    fontSize: "0.78rem",
    color: "var(--text-muted, #7a6e56)",
    textAlign: "center",
    marginBottom: "0.6rem",
    lineHeight: 1.4,
  },

  footerNote: {
    marginTop: "2rem",
    fontFamily: "'Cormorant Garamond', serif",
    fontStyle: "italic",
    fontSize: "0.85rem",
    color: "var(--text-muted, #7a6e56)",
    textAlign: "center",
    maxWidth: "560px",
    lineHeight: 1.6,
    position: "relative",
    zIndex: 1,
  },
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Mono:wght@400;500;600&display=swap');

  @keyframes shimmer {
    0% { background-position: 0% center; }
    100% { background-position: 200% center; }
  }

  .plan-card:not(.dimmed):hover {
    transform: translateY(-5px) scale(1.01);
  }

  .plan-card.selected {
    transform: translateY(-3px);
  }

  .plan-cta:not(:disabled):hover {
    filter: brightness(1.12);
    transform: translateY(-1px);
  }

  @media (max-width: 900px) {
    .plan-grid {
      grid-template-columns: repeat(2, 1fr) !important;
    }
  }
  @media (max-width: 560px) {
    .plan-grid {
      grid-template-columns: 1fr !important;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .plan-card, .plan-cta { transition: none !important; }
    h1 { animation: none !important; }
  }
`;
