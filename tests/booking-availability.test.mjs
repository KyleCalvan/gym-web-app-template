import test from 'node:test';
import assert from 'node:assert/strict';
import { getBookableDates, getBookableTimes, getCommonBookableTimes } from '../src/member/bookingAvailability.ts';

const trainer = { id: 'T-001', name: 'James Reyes' };
const schedule = (id, date, startTime, endTime, status = 'available') => ({
  id, trainerId: trainer.id, date, startTime, endTime, status,
});
const today = '2026-10-28';

test('trainer date and time options follow open one-hour slots and exclude blocked and booked starts', () => {
  const schedules = [
    schedule('old', '2026-10-27', '09:00', '11:00'),
    schedule('open', '2026-10-29', '09:00', '13:00'),
    schedule('blocked', '2026-10-29', '10:00', '11:00', 'unavailable'),
    { ...schedule('other-trainer', '2026-10-30', '09:00', '11:00'), trainerId: 'T-002' },
  ];
  const bookings = [{ trainer: trainer.name, date: '2026-10-29', time: '9:00 AM', status: 'Confirmed' }];
  assert.deepEqual(getBookableDates(schedules, bookings, trainer, today), ['2026-10-29']);
  assert.deepEqual(getBookableTimes(schedules, bookings, trainer, '2026-10-29', today), ['11:00', '12:00']);
});

test('selected dates offer only times shared across every date', () => {
  const schedules = [
    schedule('first', '2026-10-29', '09:00', '12:00'),
    schedule('second', '2026-10-30', '10:00', '13:00'),
  ];
  assert.deepEqual(getCommonBookableTimes(schedules, [], trainer, ['2026-10-29', '2026-10-30'], today), ['10:00', '11:00']);
  assert.deepEqual(getCommonBookableTimes(schedules, [], trainer, [], today), []);
});

test('today excludes elapsed starts and schedules shorter than a session', () => {
  const schedules = [
    schedule('today', today, '09:00', '12:00'),
    schedule('short', '2026-10-29', '09:00', '09:30'),
  ];
  assert.deepEqual(getBookableDates(schedules, [], trainer, today, '10:15'), [today]);
  assert.deepEqual(getBookableTimes(schedules, [], trainer, today, today, '10:15'), ['11:00']);
});
