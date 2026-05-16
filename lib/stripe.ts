/**
 * Stripe integration stub.
 * Wire up the Stripe SDK here when payment integration is ready.
 * The webhook handler at /api/webhooks/stripe already exists and
 * will call helpers from this file once implemented.
 */

export async function handleStripeWebhook(payload: string, signature: string): Promise<void> {
  void payload;
  void signature;
  // TODO: initialise Stripe client, verify webhook signature, handle events
  // Events to handle when implementing:
  //   checkout.session.completed     → create PURCHASE UserGrant, set stripePaymentIntentId
  //   customer.subscription.created  → update User.subscriptionTier + subscriptionStatus
  //   customer.subscription.updated  → update User.subscriptionTier + subscriptionStatus
  //   customer.subscription.deleted  → downgrade User.subscriptionTier to free, status to cancelled
  //   invoice.payment_failed         → set User.subscriptionStatus to past_due
  console.log("[stripe] webhook received — integration not yet active");
}
