import { getBookingCurrentTime, getBookingToday } from '../member/bookingDates.ts';

export interface TrainerDashboardSession {
  id: string;
  member: string;
  date: string;
  time: string;
  type: string;
  status: string;
  rating?: number | null;
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function trainerDashboardData(sessions: TrainerDashboardSession[], now = new Date()) {
  const today = getBookingToday(now);
  const currentTime = getBookingCurrentTime(now);
  const weekEnd = addDays(today, 6);
  const active = sessions.filter(session => session.status === 'Pending' || session.status === 'Confirmed');
  const todays = sessions.filter(session => session.date === today && session.status !== 'Cancelled')
    .sort((a, b) => a.time.localeCompare(b.time));
  const rated = sessions.filter(session => typeof session.rating === 'number' && session.status === 'Completed');

  return {
    today,
    todays,
    sessionsToday: todays.length,
    thisWeekCount: active.filter(session => session.date >= today && session.date <= weekEnd).length,
    upcomingCount: active.filter(session => session.date > today || (session.date === today && session.time >= currentTime)).length,
    avgRating: rated.length
      ? (rated.reduce((sum, session) => sum + session.rating!, 0) / rated.length).toFixed(1)
      : '—',
  };
}
