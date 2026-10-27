import type { Session, TrainerAvailability } from '../types.ts';
import { getBookingCurrentTime, getBookingToday, isBookingSlotAvailable } from './bookingDates.ts';
import { timeInMinutes } from '../trainer/availability.ts';

const SESSION_MINUTES = 60;

function clockTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function getBookableTimes(
  schedules: readonly TrainerAvailability[],
  bookings: readonly Pick<Session, 'trainer' | 'date' | 'time' | 'status'>[],
  trainer: { id: string; name: string },
  date: string,
  today: string = getBookingToday(),
  currentTime: string = getBookingCurrentTime(),
): string[] {
  if (date < today) return [];
  const blocked = schedules.filter(slot => slot.trainerId === trainer.id && slot.date === date && slot.status === 'unavailable');
  const open = schedules.filter(slot => slot.trainerId === trainer.id && slot.date === date && slot.status === 'available');
  const starts = new Set<string>();

  for (const slot of open) {
    const start = timeInMinutes(slot.startTime);
    const end = timeInMinutes(slot.endTime);
    if (start === null || end === null) continue;
    for (let minute = start; minute + SESSION_MINUTES <= end; minute += SESSION_MINUTES) {
      if (date === today && minute <= (timeInMinutes(currentTime) ?? 0)) continue;
      if (blocked.some(period => {
        const from = timeInMinutes(period.startTime);
        const until = timeInMinutes(period.endTime);
        return from !== null && until !== null && minute < until && minute + SESSION_MINUTES > from;
      })) continue;
      const time = clockTime(minute);
      if (isBookingSlotAvailable(bookings, { trainer: trainer.name, date, time })) starts.add(time);
    }
  }

  return [...starts].sort();
}

export function getBookableDates(
  schedules: readonly TrainerAvailability[],
  bookings: readonly Pick<Session, 'trainer' | 'date' | 'time' | 'status'>[],
  trainer: { id: string; name: string },
  today: string = getBookingToday(),
  currentTime: string = getBookingCurrentTime(),
): string[] {
  const dates = new Set(schedules.filter(slot => slot.trainerId === trainer.id && slot.status === 'available' && slot.date >= today).map(slot => slot.date));
  return [...dates].sort().filter(date => getBookableTimes(schedules, bookings, trainer, date, today, currentTime).length > 0);
}

export function getCommonBookableTimes(
  schedules: readonly TrainerAvailability[],
  bookings: readonly Pick<Session, 'trainer' | 'date' | 'time' | 'status'>[],
  trainer: { id: string; name: string },
  dates: readonly string[],
  today: string = getBookingToday(),
  currentTime: string = getBookingCurrentTime(),
): string[] {
  if (!dates.length) return [];
  const [first, ...rest] = dates;
  return getBookableTimes(schedules, bookings, trainer, first, today, currentTime)
    .filter(time => rest.every(date => getBookableTimes(schedules, bookings, trainer, date, today, currentTime).includes(time)));
}
