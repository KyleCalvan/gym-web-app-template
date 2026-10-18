import type { Member, Plan, Promotion } from '../types.ts';
import {
  computeDiscountedPrice,
  getActivePromotionsForMember,
  promotionAppliesToPlan,
  promotionMeetsMinSpend,
} from './promotionEligibility.ts';

export interface PlanDiff {
  plan: Plan;
  isCurrent: boolean;
  isUpgrade: boolean;
  isDowngrade: boolean;
  sameCategory: boolean;
  priceDiff: number;
  priceDiffPct: number;
  addedBenefits: string[];
  removedBenefits: string[];
  sharedBenefits: string[];
  newFacilities: string[];
  lostFacilities: string[];
  newRestrictions: string[];
  lostRestrictions: string[];
  sessionLimitCurrent: number | 'unlimited';
  sessionLimitPlan: number | 'unlimited';
  sessionLimitDiff: number;
  durationMonthsCurrent: number;
  durationMonthsPlan: number;
  discount: { promo: Promotion; discountedPrice: number; savings: number } | null;
}

const normalizeList = (items: string[] | undefined | null): string[] => {
  if (!items) return [];
  return Array.from(new Set(items.map((item) => String(item).trim()).filter(Boolean)));
};

export function planDurationMonths(plan: { period?: string } | null | undefined): number {
  const period = String(plan?.period || 'mo').toLowerCase();
  if (period.includes('year') || period === 'yr' || period === 'y') return 12;
  return 1;
}

function bestDiscount(plan: Plan, basePrice: number, member: Member, activePromotions: Promotion[]) {
  let best: { promo: Promotion; discountedPrice: number; savings: number } | null = null;
  for (const promo of activePromotions) {
    if (!promotionAppliesToPlan(promo, plan.name)) continue;
    if (!promotionMeetsMinSpend(promo, basePrice)) continue;
    const discounted = computeDiscountedPrice(promo, basePrice);
    if (discounted === null || discounted >= basePrice) continue;
    if (!best || discounted < best.discountedPrice) {
      best = { promo, discountedPrice: discounted, savings: basePrice - discounted };
    }
  }
  return best;
}

/**
 * Computes a structured diff between a member's current plan and a comparison plan.
 * Surfaces the price difference, benefit/facility/restriction/session-limit deltas,
 * and the best active promotion that applies to the new plan.
 */
export function comparePlans(
  currentPlan: Plan,
  plan: Plan,
  member: Pick<Member, 'id' | 'plan'>,
  promotions: Promotion[] = [],
  redemptions: { memberId: string; promotionId: string }[] = [],
  asOf: string | Date = new Date(),
): PlanDiff {
  const isCurrent = currentPlan.name === plan.name;
  const currentBenefits = normalizeList(currentPlan.includedBenefits?.length ? currentPlan.includedBenefits : currentPlan.perks);
  const planBenefits = normalizeList(plan.includedBenefits?.length ? plan.includedBenefits : plan.perks);

  const currentSet = new Set(currentBenefits);
  const planSet = new Set(planBenefits);
  const addedBenefits = planBenefits.filter((benefit) => !currentSet.has(benefit));
  const removedBenefits = currentBenefits.filter((benefit) => !planSet.has(benefit));
  const sharedBenefits = currentBenefits.filter((benefit) => planSet.has(benefit));

  const currentFacilities = new Set(normalizeList(currentPlan.facilities));
  const planFacilities = normalizeList(plan.facilities);
  const newFacilities = planFacilities.filter((facility) => !currentFacilities.has(facility));
  const lostFacilities = normalizeList(currentPlan.facilities).filter((facility) => !new Set(planFacilities).has(facility));

  const currentRestrictions = new Set(normalizeList(currentPlan.restrictions));
  const planRestrictions = normalizeList(plan.restrictions);
  const newRestrictions = planRestrictions.filter((restriction) => !currentRestrictions.has(restriction));
  const lostRestrictions = normalizeList(currentPlan.restrictions).filter((restriction) => !new Set(planRestrictions).has(restriction));

  const sessionLimitCurrent = (currentPlan.sessionLimit ?? 'unlimited') as number | 'unlimited';
  const sessionLimitPlan = (plan.sessionLimit ?? 'unlimited') as number | 'unlimited';
  const sessionLimitDiff =
    typeof sessionLimitCurrent === 'number' && typeof sessionLimitPlan === 'number'
      ? sessionLimitPlan - sessionLimitCurrent
      : 0;

  const priceDiff = (plan.price || 0) - (currentPlan.price || 0);
  const priceDiffPct = currentPlan.price > 0 ? Math.round((priceDiff / currentPlan.price) * 100) : 0;
  const isUpgrade = priceDiff > 0;
  const isDowngrade = priceDiff < 0;
  const sameCategory = !!currentPlan.category && currentPlan.category === plan.category;

  let discount: PlanDiff['discount'] = null;
  if (!isCurrent && member?.id) {
    const active = getActivePromotionsForMember(promotions || [], redemptions || [], { ...member, plan: plan.name }, asOf);
    discount = bestDiscount(plan, plan.price, member as Member, active);
  }

  return {
    plan,
    isCurrent,
    isUpgrade,
    isDowngrade,
    sameCategory,
    priceDiff,
    priceDiffPct,
    addedBenefits,
    removedBenefits,
    sharedBenefits,
    newFacilities,
    lostFacilities,
    newRestrictions,
    lostRestrictions,
    sessionLimitCurrent,
    sessionLimitPlan,
    sessionLimitDiff,
    durationMonthsCurrent: planDurationMonths(currentPlan),
    durationMonthsPlan: planDurationMonths(plan),
    discount,
  };
}

export interface CancelConfirmation {
  intent: 'cancel';
  memberId: string;
  planName: string;
  reason: string;
  effectiveImmediately: boolean;
  summary: string;
}

/**
 * Builds a destructive plan-cancellation confirmation payload.
 * Distinct from a payment-method change, which would have intent: 'payment-method'.
 */
export function buildCancelConfirmation(
  member: Pick<Member, 'id' | 'plan'>,
  plan: Pick<Plan, 'name'>,
  options: { reason?: string; effectiveImmediately?: boolean } = {},
): CancelConfirmation {
  const reason = (options.reason || '').trim() || 'No reason provided';
  return {
    intent: 'cancel',
    memberId: member.id,
    planName: plan.name,
    reason,
    effectiveImmediately: options.effectiveImmediately !== false,
    summary: `Cancel ${plan.name} for ${member.id} (${reason})`,
  };
}
