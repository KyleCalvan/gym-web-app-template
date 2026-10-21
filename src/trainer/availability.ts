import type { Session, TrainerAvailability } from '../types.ts';
import { BOOKING_TIME_ZONE, getBookingCurrentTime, getBookingToday } from '../member/bookingDates.ts';

function timeInMinutes(value: string): number | null {
  const twentyFourHour = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (twentyFourHour) return Number(twentyFourHour[1]) * 60 + Number(twentyFourHour[2]);

  const twelveHour = /^(1[0-2]|0?[1-9]):([0-5]\d)\s*(AM|PM)$/i.exec(value.trim());
  if (!twelveHour) return null;
  const hour = Number(twelveHour[1]) % 12 + (/PM/i.test(twelveHour[3]) ? 12 : 0);
  return hour * 60 + Number(twelveHour[2]);
}

export function formatTime12h(value: string): string {
  const trimmed = value.trim();
  // If it's already 12-hour with AM/PM, return as-is with proper format
  const twelveHour = /^(1[0-2]|0?[1-9]):([0-5]\d)\s*(AM|PM)$/i.exec(trimmed);
  if (twelveHour) {
    return `${Number(twelveHour[1])}:${twelveHour[2]} ${twelveHour[3].toUpperCase()}`;
  }
  // Parse as 24-hour
  const twentyFourHour = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(trimmed);
  if (twentyFourHour) {
    const hour24 = Number(twentyFourHour[1]);
    const min = twentyFourHour[2];
    const period = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    return `${hour12}:${min} ${period}`;
  }
  return value;
}

function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isTrainerAvailability(value: unknown): value is TrainerAvailability {
  if (!value || typeof value !== 'object') return false;
  const schedule = value as Partial<TrainerAvailability>;
  return typeof schedule.id === 'string'
    && typeof schedule.trainerId === 'string'
    && typeof schedule.date === 'string'
    && isValidISODate(schedule.date)
    && typeof schedule.startTime === 'string'
    && timeInMinutes(schedule.startTime) !== null
    && typeof schedule.endTime === 'string'
    && timeInMinutes(schedule.endTime) !== null
    && (schedule.status === 'available' || schedule.status === 'unavailable');
}

export function validateAvailabilityChange(
  schedules: readonly TrainerAvailability[],
  sessions: readonly Session[],
  trainerId: string,
  trainerName: string,
  date: string,
  now: Date = new Date(),
  timeZone: string = BOOKING_TIME_ZONE,
): string | null {
  if (!isValidISODate(date)) {
    return 'Choose a valid schedule date.';
  }

  const daySchedules = schedules.filter(
    (schedule) => schedule.trainerId === trainerId && schedule.date === date,
  );

  if (daySchedules.length > 0) {
    const today = getBookingToday(now, timeZone);
    if (date < today) {
      return 'Availability must be scheduled for a future date and time.';
    }
    if (date === today) {
      const currentTime = timeInMinutes(getBookingCurrentTime(now, timeZone));
      if (currentTime !== null && daySchedules.some((schedule) => {
        const startTime = timeInMinutes(schedule.startTime);
        return startTime !== null && startTime <= currentTime;
      })) {
        return 'Availability must start at a future time.';
      }
    }
  }

  for (const schedule of daySchedules) {
    const start = timeInMinutes(schedule.startTime);
    const end = timeInMinutes(schedule.endTime);
    if (start === null || end === null || start >= end) {
      return 'Enter a valid start and end time. The end time must be later than the start time.';
    }
  }

  for (let i = 0; i < daySchedules.length; i += 1) {
    const current = daySchedules[i];
    for (let j = i + 1; j < daySchedules.length; j += 1) {
      const other = daySchedules[j];
      const currentStart = timeInMinutes(current.startTime)!;
      const currentEnd = timeInMinutes(current.endTime)!;
      const otherStart = timeInMinutes(other.startTime)!;
      const otherEnd = timeInMinutes(other.endTime)!;
      if (currentStart < otherEnd && otherStart < currentEnd) {
        return 'This time overlaps another availability schedule.';
      }
    }
  }

  const bookedSessions = sessions.filter((session) =>
    session.trainer.trim().toLowerCase() === trainerName.trim().toLowerCase()
    && session.date === date
    && session.status !== 'Cancelled'
    && session.status !== 'Completed',
  );

  for (const session of bookedSessions) {
    const bookingTime = timeInMinutes(session.time);
    if (bookingTime === null) continue;
    const isUnavailable = daySchedules.some((schedule) =>
      schedule.status === 'unavailable'
      && bookingTime >= timeInMinutes(schedule.startTime)!
      && bookingTime < timeInMinutes(schedule.endTime)!,
    );
    const hasAvailability = daySchedules.some((schedule) =>
      schedule.status === 'available'
      && bookingTime >= timeInMinutes(schedule.startTime)!
      && bookingTime < timeInMinutes(schedule.endTime)!,
    );
    if (isUnavailable || !hasAvailability) {
      return `This change conflicts with booking ${session.id} at ${session.time}. Keep an available slot around that booking.`;
    }
  }

  return null;
}
