import assert from 'node:assert/strict';
import { test } from 'node:test';
import { trainerDashboardData } from '../src/trainer/dashboardData.ts';

const now = new Date('2026-10-27T16:30:00.000Z'); // 00:30 on October 28 in Manila.
const session = (id, date, time, status, rating = null) => ({
  id, member: 'Member', date, time, type: 'Personal Training', status, rating,
});

test('trainer dashboard uses gym time and only active future bookings for upcoming counts', () => {
  const data = trainerDashboardData([
    session('past', '2026-10-27', '23:30', 'Confirmed'),
    session('earlier-today', '2026-10-28', '00:00', 'Completed'),
    session('today', '2026-10-28', '09:00', 'Confirmed'),
    session('pending', '2026-10-28', '08:00', 'Pending'),
    session('cancelled', '2026-10-28', '10:00', 'Cancelled'),
    session('week-end', '2026-11-03', '09:00', 'Confirmed'),
    session('later', '2026-11-04', '09:00', 'Confirmed'),
    session('rated', '2026-10-20', '09:00', 'Completed', 4),
    session('rated-2', '2026-10-21', '09:00', 'Completed', 5),
  ], now);

  assert.equal(data.today, '2026-10-28');
  assert.deepEqual(data.todays.map(item => item.id), ['earlier-today', 'pending', 'today']);
  assert.equal(data.sessionsToday, 3);
  assert.equal(data.thisWeekCount, 3);
  assert.equal(data.upcomingCount, 4);
  assert.equal(data.avgRating, '4.5');
});

test('trainer dashboard shows an empty rating when no completed sessions are reviewed', () => {
  assert.equal(trainerDashboardData([session('one', '2026-10-28', '09:00', 'Confirmed')], now).avgRating, '—');
});
