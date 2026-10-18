import type { Member, Promotion } from '../types.ts';
import { getEligiblePromotions } from './promotionEligibility.ts';

export interface PromotionSeenStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function chooseLoginPromotion(
  promotions: Promotion[],
  member: Pick<Member, 'id' | 'plan'> | null | undefined,
  storage?: PromotionSeenStorage,
  asOf: string | Date = new Date(),
): Promotion | null {
  if (!member?.id) return null;

  for (const promotion of getEligiblePromotions(promotions, member, asOf)) {
    const key = `vinathletics:member-promo:${member.id}:${promotion.id}`;
    try {
      if (storage?.getItem(key)) continue;
      storage?.setItem(key, 'shown');
    } catch {
      // Storage may be unavailable; return the offer rather than block login.
    }
    return promotion;
  }
  return null;
}
