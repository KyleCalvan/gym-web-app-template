export interface NameParts { firstName: string; middleName: string; lastName: string; suffix: string; }
export const emptyName = (): NameParts => ({ firstName: '', middleName: '', lastName: '', suffix: '' });
export function formatName(parts: NameParts): string {
  return [parts.firstName, parts.middleName, parts.lastName, parts.suffix].map(p => p.trim()).filter(Boolean).join(' ');
}
// Legacy names retain their word order. Splitting cannot infer family-name boundaries;
// existing records are never rewritten until the user explicitly saves the form.
export function splitName(value: string | { name: string; firstName?: string; middleName?: string; lastName?: string; suffix?: string }): NameParts {
  if (typeof value !== 'string' && value.firstName && value.lastName) return { ...emptyName(), ...value };
  const words = (typeof value === 'string' ? value : value.name).trim().split(/\s+/).filter(Boolean);
  const suffix = words.length > 2 && /^(jr\.?|sr\.?|ii|iii|iv|v)$/i.test(words.at(-1) || '') ? words.pop()! : '';
  const firstName = words.shift() || '';
  const lastName = words.length ? words.pop()! : '';
  return { firstName, middleName: words.join(' '), lastName, suffix };
}
