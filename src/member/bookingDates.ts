export const BOOKING_TIME_ZONE =
  process.env.NEXT_PUBLIC_BOOKING_TIME_ZONE || 'Asia/Manila';

export interface BookingSlot {
  id?: string;
  trainer?: string;
  date?: string;
  time?: string;
  status?: string;
}

export function getBookingToday(
  now: Date = new Date(),
  timeZone: string = BOOKING_TIME_ZONE,
): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find((entry) => entry.type === type)?.value;
    if (!value) throw new Error(`Unable to determine ${type} in ${timeZone}.`);
    return value;
  };

  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function getBookingCurrentTime(
  now: Date = new Date(),
  timeZone: string = BOOKING_TIME_ZONE,
): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find((entry) => entry.type === type)?.value;
    if (!value) throw new Error(`Unable to determine ${type} in ${timeZone}.`);
    return value;
  };

  return `${part('hour')}:${part('minute')}`;
}

function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function getBookingDateError(
  date: string,
  today: string = getBookingToday(),
): string | null {
  if (!isValidISODate(date)) return 'Choose a valid session date.';
  if (date < today) return 'Bookings must be scheduled for today or a future date.';
  return null;
}

export function getBookingDatesError(
  dates: readonly string[],
  today: string = getBookingToday(),
): string | null {
  if (!dates.length) return 'Choose at least one session date.';

  for (const date of dates) {
    const error = getBookingDateError(date, today);
    if (error) return error;
  }

  if (new Set(dates).size !== dates.length) return 'A session date can only be added once.';
  return null;
}

function timeInMinutes(value: string): number | null {
  const twentyFourHour = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (twentyFourHour) return Number(twentyFourHour[1]) * 60 + Number(twentyFourHour[2]);

  const twelveHour = /^(1[0-2]|0?[1-9]):([0-5]\d)\s*(AM|PM)$/i.exec(value.trim());
  if (!twelveHour) return null;
  const hour = Number(twelveHour[1]) % 12 + (/PM/i.test(twelveHour[3]) ? 12 : 0);
  return hour * 60 + Number(twelveHour[2]);
}

export function isBookingSlotAvailable(
  bookings: readonly BookingSlot[],
  slot: { trainer: string; date: string; time: string; excludeBookingId?: string },
): boolean {
  const requestedTime = timeInMinutes(slot.time);
  return !bookings.some((booking) => {
    if (
      booking.id === slot.excludeBookingId ||
      booking.status === 'Cancelled' ||
      booking.status === 'Completed' ||
      booking.date !== slot.date ||
      booking.trainer?.trim().toLowerCase() !== slot.trainer.trim().toLowerCase()
    ) return false;

    const existingTime = booking.time ? timeInMinutes(booking.time) : null;
    return requestedTime !== null && existingTime !== null
      ? requestedTime === existingTime
      : booking.time?.trim().toLowerCase() === slot.time.trim().toLowerCase();
  });
}
