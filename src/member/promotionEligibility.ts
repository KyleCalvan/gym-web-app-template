import type { Member, Promotion } from '../types.ts';

function normalizeDate(value: string | Date | null | undefined): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  if (typeof value !== 'string' || !value.trim()) return null;

  const input = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const check = new Date(`${input}T00:00:00Z`);
    return !Number.isNaN(check.getTime()) && check.toISOString().slice(0, 10) === input ? input : null;
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

const normalizePlan = (value: string | null | undefined): string =>
  (value ?? '').trim().toLowerCase();

export function formatPromotionDate(value: string | Date | null | undefined): string {
  const normalized = normalizeDate(value);
  if (!normalized) return 'Date not set';
  const [year, month, day] = normalized.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}

export function formatPromotionDiscount(promotion: Promotion): string {
  const kind = normalizePlan(promotion.discountType);
  if (kind === 'percentage') return `${promotion.discount}% off`;
  if (kind === 'fixed' || kind === 'fixed amount') return `₱${promotion.discount} off`;
  return promotion.discount;
}

export function getEligiblePromotions(
  promotions: Promotion[] = [],
  member: Pick<Member, 'plan'> | null | undefined,
  asOf: string | Date = new Date(),
): Promotion[] {
  const today = normalizeDate(asOf);
  const memberPlan = normalizePlan(member?.plan);
  if (!today || !memberPlan) return [];

  return promotions
    .filter((promotion) => {
      if (promotion.status !== 'Published') return false;
      const validFrom = normalizeDate(promotion.validFrom);
      const validUntil = normalizeDate(promotion.validUntil);
      if (!validFrom || !validUntil || validFrom > validUntil) return false;
      if (today < validFrom || today > validUntil) return false;

      const targetPlan = normalizePlan(promotion.plan);
      if (!targetPlan || (targetPlan !== 'any' && targetPlan !== 'any plan' && targetPlan !== memberPlan)) return false;

      const maxRedemptions = Number(promotion.maxRedemptions) || 0;
      const redemptions = Number(promotion.redemptions) || 0;
      return maxRedemptions <= 0 || redemptions < maxRedemptions;
    })
    .slice()
    .sort((a, b) => (normalizeDate(a.validUntil) ?? '').localeCompare(normalizeDate(b.validUntil) ?? '') || a.id.localeCompare(b.id));
}

/* ===== Redemption & discount helpers ===== */

export interface PromotionRedemptionLike {
  memberId: string;
  promotionId: string;
}

/** True when the promotion targets every plan (usable for sessions and any plan card). */
export function promotionTargetsAllPlans(promotion: Promotion): boolean {
  const target = normalizePlan(promotion?.plan);
  return target === 'any' || target === 'any plan';
}

/** True when the promotion applies to a specific plan name (Any matches everything). */
export function promotionAppliesToPlan(promotion: Promotion, planName: string | null | undefined): boolean {
  const plan = normalizePlan(planName);
  if (!plan || !promotion) return false;
  return promotionTargetsAllPlans(promotion) || normalizePlan(promotion.plan) === plan;
}

/** True when the purchase amount satisfies the promotion's minimum-spend condition. */
export function promotionMeetsMinSpend(promotion: Promotion, spend: number): boolean {
  const min = Number(promotion?.minSpend) || 0;
  return min <= 0 || Number(spend) >= min;
}

/**
 * Computes the discounted price for a single purchase amount.
 * Returns null when the promotion type has no automatic price reduction
 * (Bundle / custom) or the values are unusable.
 */
export function computeDiscountedPrice(promotion: Promotion, originalPrice: number): number | null {
  const price = Number(originalPrice);
  if (!promotion || !Number.isFinite(price) || price <= 0) return null;
  const kind = normalizePlan(promotion.discountType);
  if (kind === 'percentage') {
    const pct = Number(promotion.discount);
    if (!Number.isFinite(pct) || pct <= 0) return null;
    return Math.max(0, Math.round(price * (1 - Math.min(pct, 100) / 100)));
  }
  if (kind === 'fixed' || kind === 'fixed amount') {
    const amount = Number(promotion.discount);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return Math.max(0, Math.round(price - amount));
  }
  return null;
}

/** Promotions a member has redeemed (by redemption records). */
export function getRedeemedPromotions(
  promotions: Promotion[] = [],
  redemptions: PromotionRedemptionLike[] = [],
  memberId: string | null | undefined,
): Promotion[] {
  if (!memberId) return [];
  const redeemedIds = new Set(
    (redemptions || []).filter((r) => r.memberId === memberId).map((r) => r.promotionId),
  );
  return (promotions || []).filter((p) => redeemedIds.has(p.id));
}

/** Redeemed promotions that are still published, in-date, plan-eligible, and under the redemption cap. */
export function getActivePromotionsForMember(
  promotions: Promotion[] = [],
  redemptions: PromotionRedemptionLike[] = [],
  member: Pick<Member, 'id' | 'plan'> | null | undefined,
  asOf: string | Date = new Date(),
): Promotion[] {
  if (!member?.id) return [];
  const redeemed = getRedeemedPromotions(promotions, redemptions, member.id);
  return getEligiblePromotions(redeemed, member, asOf);
}

/**
 * Validates a typed-in promotion code for redemption by a member.
 * Returns the promotion on success, or a user-facing error message.
 */
export function findRedeemablePromotion(
  promotions: Promotion[] = [],
  redemptions: PromotionRedemptionLike[] = [],
  member: Pick<Member, 'id' | 'plan'> | null | undefined,
  code: string,
  asOf: string | Date = new Date(),
): { promotion: Promotion | null; error: string | null } {
  const input = (code ?? '').trim().toUpperCase();
  if (!input) return { promotion: null, error: 'Enter a promotion code' };
  if (!member?.id) return { promotion: null, error: 'Sign in to redeem a promotion' };

  const promotion = (promotions || []).find(
    (p) => (p.code ?? '').trim().toUpperCase() === input,
  );
  if (!promotion) return { promotion: null, error: 'Invalid promotion code' };

  if (promotion.status !== 'Published') {
    return { promotion: null, error: 'This promotion is not available' };
  }

  const today = normalizeDate(asOf);
  const validFrom = normalizeDate(promotion.validFrom);
  const validUntil = normalizeDate(promotion.validUntil);
  if (!today || !validFrom || !validUntil || validFrom > validUntil) {
    return { promotion: null, error: 'This promotion has invalid dates' };
  }
  if (today < validFrom) {
    return { promotion: null, error: `This promotion starts on ${formatPromotionDate(validFrom)}` };
  }
  if (today > validUntil) {
    return { promotion: null, error: 'This promotion has expired' };
  }

  if (!promotionAppliesToPlan(promotion, member.plan)) {
    return { promotion: null, error: 'This promotion is not available for your plan' };
  }

  const maxRedemptions = Number(promotion.maxRedemptions) || 0;
  const redemptionsCount = Number(promotion.redemptions) || 0;
  if (maxRedemptions > 0 && redemptionsCount >= maxRedemptions) {
    return { promotion: null, error: 'This promotion has been fully redeemed' };
  }

  const alreadyRedeemed = (redemptions || []).some(
    (r) => r.memberId === member.id && r.promotionId === promotion.id,
  );
  if (alreadyRedeemed) {
    return { promotion: null, error: 'You have already redeemed this promotion' };
  }

  return { promotion, error: null };
}
