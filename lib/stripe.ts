import { addCreditTransaction } from "@/lib/credits";
import { establishLimitFloorsForTier } from "@/lib/limit-floors";
import { prisma } from "@/lib/prisma";
import { CreditTransactionReason, GrantSource, SubscriptionStatus, SubscriptionTier } from "@db";
import Stripe from "stripe";

const TIER_ORDER: Record<SubscriptionTier, number> = {
  [SubscriptionTier.free]: 0,
  [SubscriptionTier.standard]: 1,
  [SubscriptionTier.premium]: 2,
};

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

function tierFromStripePrice(priceId: string | null | undefined): SubscriptionTier | null {
  if (!priceId) return null;
  const map: Record<string, SubscriptionTier> = {};
  if (process.env.STRIPE_PRICE_ID_FREE) map[process.env.STRIPE_PRICE_ID_FREE] = SubscriptionTier.free;
  if (process.env.STRIPE_PRICE_ID_STANDARD) {
    map[process.env.STRIPE_PRICE_ID_STANDARD] = SubscriptionTier.standard;
  }
  if (process.env.STRIPE_PRICE_ID_PREMIUM) {
    map[process.env.STRIPE_PRICE_ID_PREMIUM] = SubscriptionTier.premium;
  }
  return map[priceId] ?? null;
}

async function resolveTierFromSubscription(sub: Stripe.Subscription): Promise<SubscriptionTier | null> {
  const priceId = sub.items.data[0]?.price?.id;
  const fromEnv = tierFromStripePrice(priceId);
  if (fromEnv) return fromEnv;

  if (priceId) {
    const config = await prisma.tierLimitConfig.findFirst({
      where: { stripePriceId: priceId },
      select: { tier: true },
    });
    if (config) return config.tier;
  }
  return null;
}

async function findUserByStripeCustomer(customerId: string) {
  return prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true, subscriptionTier: true },
  });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.userId;
  if (!userId) {
    console.warn("[stripe] checkout.session.completed missing userId metadata");
    return;
  }

  if (session.mode === "subscription" && session.subscription) {
    const stripe = getStripe();
    if (!stripe) return;
    const sub =
      typeof session.subscription === "string"
        ? await stripe.subscriptions.retrieve(session.subscription)
        : session.subscription;

    const tier = await resolveTierFromSubscription(sub);
    const periodStart = new Date((sub as Stripe.Subscription & { current_period_start: number }).current_period_start * 1000);

    await prisma.user.update({
      where: { id: userId },
      data: {
        stripeCustomerId:
          typeof session.customer === "string" ? session.customer : session.customer?.id,
        stripeSubscriptionId: sub.id,
        subscriptionStatus: SubscriptionStatus.active,
        ...(tier ? { subscriptionTier: tier } : {}),
        usagePeriodStart: periodStart,
      },
    });
    if (tier) {
      await establishLimitFloorsForTier(userId, tier);
    }
    return;
  }

  if (session.mode === "payment") {
    const packId = session.metadata?.creditPackId;
    const credits = Number(session.metadata?.credits ?? 0);
    if (!packId || credits <= 0) return;

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null;

    if (paymentIntentId) {
      const existing = await prisma.creditTransaction.findFirst({
        where: { stripePaymentIntentId: paymentIntentId },
      });
      if (existing) return;
    }

    await addCreditTransaction({
      userId,
      amount: credits,
      reason: CreditTransactionReason.PURCHASE,
      creditPackId: packId,
      stripePaymentIntentId: paymentIntentId,
      note: session.metadata?.packName ?? "Credit pack purchase",
    });

    if (session.customer) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          stripeCustomerId:
            typeof session.customer === "string" ? session.customer : session.customer.id,
        },
      });
    }
  }
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!customerId) return;

  const user = await findUserByStripeCustomer(customerId);
  if (!user) return;

  const newTier = await resolveTierFromSubscription(sub);
  const periodStart = new Date((sub as Stripe.Subscription & { current_period_start: number }).current_period_start * 1000);
  const upgraded =
    newTier !== null && TIER_ORDER[newTier] > TIER_ORDER[user.subscriptionTier];

  const tierChanged = newTier !== null && newTier !== user.subscriptionTier;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeSubscriptionId: sub.id,
      subscriptionStatus:
        sub.status === "active" || sub.status === "trialing"
          ? SubscriptionStatus.active
          : sub.status === "past_due"
            ? SubscriptionStatus.past_due
            : SubscriptionStatus.cancelled,
      ...(newTier ? { subscriptionTier: newTier } : {}),
      usagePeriodStart: upgraded ? new Date() : periodStart,
    },
  });

  if (tierChanged && newTier) {
    await establishLimitFloorsForTier(user.id, newTier);
  }
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!customerId) return;

  const user = await findUserByStripeCustomer(customerId);
  if (!user) return;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionTier: SubscriptionTier.free,
      subscriptionStatus: SubscriptionStatus.cancelled,
      stripeSubscriptionId: null,
    },
  });

  await establishLimitFloorsForTier(user.id, SubscriptionTier.free);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const user = await findUserByStripeCustomer(customerId);
  if (!user) return;

  await prisma.user.update({
    where: { id: user.id },
    data: { subscriptionStatus: SubscriptionStatus.past_due },
  });
}

export async function handleStripeWebhook(payload: string, signature: string): Promise<void> {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    console.log("[stripe] webhook received — STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET not set");
    return;
  }

  const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
      break;
    default:
      break;
  }
}

export async function getOrCreateStripeCustomer(userId: string, email: string): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });
  if (user?.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

export async function createSubscriptionCheckout(params: {
  userId: string;
  email: string;
  tier: SubscriptionTier;
  successUrl: string;
  cancelUrl: string;
}): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const tierConfig = await prisma.tierLimitConfig.findUnique({
    where: { tier: params.tier },
    select: { stripePriceId: true },
  });

  const priceId =
    tierConfig?.stripePriceId ??
    (params.tier === SubscriptionTier.standard
      ? process.env.STRIPE_PRICE_ID_STANDARD
      : params.tier === SubscriptionTier.premium
        ? process.env.STRIPE_PRICE_ID_PREMIUM
        : process.env.STRIPE_PRICE_ID_FREE);

  if (!priceId) return null;

  const customerId = await getOrCreateStripeCustomer(params.userId, params.email);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId ?? undefined,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: { userId: params.userId, tier: params.tier },
    subscription_data: {
      metadata: { userId: params.userId, tier: params.tier },
    },
  });

  return session.url;
}

export async function createCreditPackCheckout(params: {
  userId: string;
  email: string;
  packId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const [pack, user] = await Promise.all([
    prisma.creditPack.findUnique({ where: { id: params.packId } }),
    prisma.user.findUnique({
      where: { id: params.userId },
      select: { subscriptionTier: true },
    }),
  ]);

  if (!pack || !pack.active || !user) return null;

  const tierConfig = await prisma.tierLimitConfig.findUnique({
    where: { tier: user.subscriptionTier },
    select: { creditPurchasesEnabled: true },
  });
  if (!tierConfig?.creditPurchasesEnabled) return null;

  const priceCents =
    user.subscriptionTier === SubscriptionTier.premium
      ? pack.pricePremium
      : user.subscriptionTier === SubscriptionTier.standard
        ? pack.priceStandard
        : pack.priceFree;

  const customerId = await getOrCreateStripeCustomer(params.userId, params.email);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId ?? undefined,
    line_items: pack.stripePriceId
      ? [{ price: pack.stripePriceId, quantity: 1 }]
      : [
          {
            price_data: {
              currency: "usd",
              unit_amount: priceCents,
              product_data: { name: pack.name },
            },
            quantity: 1,
          },
        ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      userId: params.userId,
      creditPackId: pack.id,
      credits: String(pack.credits),
      packName: pack.name,
    },
  });

  return session.url;
}

export async function createBillingPortalSession(params: {
  userId: string;
  returnUrl: string;
}): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { stripeCustomerId: true },
  });
  if (!user?.stripeCustomerId) return null;

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: params.returnUrl,
  });

  return session.url;
}

/** One-time migration: convert legacy PURCHASE UserGrant balances to CreditTransaction rows. */
export async function migrateLegacyPurchaseGrants(): Promise<number> {
  const grants = await prisma.userGrant.findMany({
    where: { source: GrantSource.PURCHASE },
    select: {
      id: true,
      userId: true,
      grantType: true,
      bonusAmount: true,
      usedAmount: true,
      stripePaymentIntentId: true,
      createdAt: true,
    },
  });

  let migrated = 0;
  for (const g of grants) {
    const remaining = Math.max(0, (g.bonusAmount ?? 0) - g.usedAmount);
    if (remaining <= 0) continue;

    await addCreditTransaction({
      userId: g.userId,
      amount: remaining,
      reason: CreditTransactionReason.ADMIN_ADJUST,
      stripePaymentIntentId: g.stripePaymentIntentId,
      note: `Migrated from legacy PURCHASE grant ${g.id} (${g.grantType})`,
    });
    migrated += 1;
  }
  return migrated;
}
