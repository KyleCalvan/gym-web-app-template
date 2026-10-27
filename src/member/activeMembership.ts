export function hasActiveMembership(
  membership: { status?: string | null; endsAt?: string | Date | null } | null | undefined,
  now = new Date(),
) {
  if (!membership || !['Active', 'Expiring'].includes(membership.status ?? '')) return false;
  const endsAt = membership.endsAt instanceof Date ? membership.endsAt : new Date(membership.endsAt ?? '');
  return !Number.isNaN(endsAt.getTime()) && endsAt > now;
}
