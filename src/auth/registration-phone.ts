export function normalizeRegistrationPhone(value: string): string | null {
  const phone = value.trim()
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[\u00a0\u202f]/g, ' ');
  const digits = phone.match(/\d/g)?.length ?? 0;
  if (phone.length > 30 || digits < 7 || digits > 15 || !/^\+?[\d()\s.-]+$/.test(phone)) return null;
  return phone;
}
