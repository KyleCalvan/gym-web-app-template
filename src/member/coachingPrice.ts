export const DEFAULT_COACHING_SESSION_PRICE_PHP = 900;

export function getCoachingSessionPricePhp(storedPrice: number): number {
  return storedPrice === 0 ? DEFAULT_COACHING_SESSION_PRICE_PHP : storedPrice;
}
