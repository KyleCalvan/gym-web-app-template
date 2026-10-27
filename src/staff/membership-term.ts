export function membershipEnd(start: Date, period: string) {
  const end = new Date(start);
  if (period === 'day') end.setUTCDate(end.getUTCDate() + 1);
  else if (period === 'mo') end.setUTCMonth(end.getUTCMonth() + 1);
  else if (period === 'qtr') end.setUTCMonth(end.getUTCMonth() + 3);
  else if (period === 'yr') end.setUTCFullYear(end.getUTCFullYear() + 1);
  else return null;
  return end;
}
