/** Stable markers for partner interest captured during onboarding (not dashboard form). */
export const ONBOARDING_PARTNER_PUBLISHER_NAME = "[Onboarding] Partner access requested";

export const ONBOARDING_PARTNER_CATALOGUE_NOTE =
  "Source: onboarding plan screen. User tapped “Request Partner Access” before completing profile. Not a full dashboard partner form submission — follow up for publisher name, catalogue, and links.";

export function isOnboardingPartnerRequest(publisherName: string | null | undefined): boolean {
  return Boolean(publisherName?.startsWith("[Onboarding]"));
}
