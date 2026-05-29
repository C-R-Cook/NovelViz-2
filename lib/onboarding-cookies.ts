export const ONBOARDING_PLAN_COOKIE = "onboarding_plan_done";

export function setPlanStepCompleteCookie(): void {
  document.cookie = `${ONBOARDING_PLAN_COOKIE}=1; path=/; max-age=86400; SameSite=Lax`;
}

export function clearPlanStepCompleteCookie(): void {
  document.cookie = `${ONBOARDING_PLAN_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}
