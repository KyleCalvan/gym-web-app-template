export type TaxMode = 'exclusive' | 'inclusive';
export interface PosTaxDetails { subtotal: number; base: number; rate: number; amount: number; mode: TaxMode; }
export function calculatePosPricing(subtotal: number, rateText: string, mode: TaxMode) {
  if (!Number.isFinite(subtotal) || subtotal < 0) throw new Error('Subtotal must be a non-negative amount.');
  const cents = Math.round(subtotal * 100);
  const configured = rateText.trim() !== '';
  const rate = configured ? Number(rateText) : 0;
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error('Enter a tax rate between 0 and 100%.');
  if (mode !== 'exclusive' && mode !== 'inclusive') throw new Error('Choose whether prices include tax.');
  const taxCents = mode === 'inclusive' ? cents - Math.round(cents / (1 + rate / 100)) : Math.round(cents * rate / 100);
  const totalCents = mode === 'inclusive' ? cents : cents + taxCents;
  return { configured, subtotal: cents / 100, base: (mode === 'inclusive' ? cents - taxCents : cents) / 100, tax: taxCents / 100, rate, total: totalCents / 100, mode };
}
