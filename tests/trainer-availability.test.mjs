import test from 'node:test';
import assert from 'node:assert/strict';
import { isTrainerAvailability, validateAvailabilityChange as validateAtTime } from '../src/trainer/availability.ts';

const validationNow = new Date('2026-10-18T09:00:00.000Z');
const validateAvailabilityChange = (...args) => validateAtTime(...args, validationNow, 'Asia/Manila');

const schedule = (overrides = {}) => ({
  id: 'availability-1',
  trainerId: 'T-001',
  date: '2026-10-20',
  startTime: '09:00',
  endTime: '11:00',
  status: 'available',
  ...overrides,
});

const booking = (overrides = {}) => ({
  id: 'booking-1',
  member: 'Maria Santos',
  trainer: 'James Reyes',
  date: '2026-10-20',
  time: '10:00 AM',
  type: 'Strength',
  status: 'Confirmed',
  paid: true,
  amount: 1200,
  ...overrides,
});

test('accepts valid persisted schedule records and ignores malformed records', () => {
  assert.equal(isTrainerAvailability(schedule()), true);
  assert.equal(isTrainerAvailability(schedule({ date: '2026-02-30' })), false);
  assert.equal(isTrainerAvailability(schedule({ startTime: '9 AM' })), false);
});

test('rejects invalid times and overlapping schedules', () => {
  assert.match(validateAvailabilityChange(
    [schedule({ startTime: '11:00', endTime: '09:00' })],
    [],
    'T-001',
    'James Reyes',
    '2026-10-20',
  ), /end time must be later/);

  assert.match(validateAvailabilityChange(
    [
      schedule(),
      schedule({ id: 'availability-2', startTime: '10:30', endTime: '12:00', status: 'unavailable' }),
    ],
    [],
    'T-001',
    'James Reyes',
    '2026-10-20',
  ), /overlaps another availability schedule/);
});

test('keeps active trainer bookings inside an available schedule', () => {
  assert.equal(validateAvailabilityChange(
    [schedule()],
    [booking()],
    'T-001',
    'James Reyes',
    '2026-10-20',
  ), null);

  assert.match(validateAvailabilityChange(
    [schedule({ endTime: '10:00' })],
    [booking()],
    'T-001',
    'James Reyes',
    '2026-10-20',
  ), /conflicts with booking booking-1/);
});

test('ignores cancelled, completed, and other trainers’ bookings', () => {
  const nonBlockingBookings = [
    booking({ status: 'Cancelled' }),
    booking({ id: 'booking-2', status: 'Completed' }),
    booking({ id: 'booking-3', trainer: 'Sarah Jenkins' }),
  ];
  assert.equal(validateAvailabilityChange(
    [schedule({ endTime: '10:00' })],
    nonBlockingBookings,
    'T-001',
    'James Reyes',
    '2026-10-20',
  ), null);
});

test('rejects invalid calendar dates', () => {
  assert.match(validateAvailabilityChange(
    [schedule({ date: '2026-02-30' })],
    [],
    'T-001',
    'James Reyes',
    '2026-02-30',
  ), /valid schedule date/);
});

test('rejects availability on previous valid dates', () => {
  const previousDate = '2026-10-17';
  const pastSchedule = schedule({ date: previousDate });
  assert.equal(isTrainerAvailability(pastSchedule), true);
  assert.match(validateAvailabilityChange(
    [pastSchedule],
    [],
    'T-001',
    'James Reyes',
    previousDate,
  ), /future date and time/);
});

test('rejects past start times today but allows future times today', () => {
  const today = '2026-10-18';
  assert.match(validateAvailabilityChange(
    [schedule({ date: today, startTime: '16:59', endTime: '18:00' })],
    [],
    'T-001',
    'James Reyes',
    today,
  ), /future time/);
  assert.equal(validateAvailabilityChange(
    [schedule({ date: today, startTime: '17:01', endTime: '18:01' })],
    [],
    'T-001',
    'James Reyes',
    today,
  ), null);
});

test('limits trainer slots to 7 AM–10 PM with at least one hour per slot', () => {
  const check = (startTime, endTime) => validateAvailabilityChange(
    [schedule({ startTime, endTime })], [], 'T-001', 'James Reyes', '2026-10-20',
  );
  assert.equal(check('07:00', '08:00'), null);
  assert.equal(check('21:00', '22:00'), null);
  assert.match(check('06:59', '08:00'), /between 7:00 AM and 10:00 PM/);
  assert.match(check('21:00', '22:01'), /between 7:00 AM and 10:00 PM/);
  assert.match(check('09:00', '09:59'), /at least 1 hour/);
});

test('limits each trainer to eight schedule slots per day', () => {
  const eightSlots = Array.from({ length: 8 }, (_, index) => schedule({
    id: `slot-${index}`, startTime: `${String(index + 7).padStart(2, '0')}:00`,
    endTime: `${String(index + 8).padStart(2, '0')}:00`,
  }));
  assert.equal(validateAvailabilityChange(eightSlots, [], 'T-001', 'James Reyes', '2026-10-20'), null);
  assert.match(validateAvailabilityChange([
    ...eightSlots, schedule({ id: 'slot-9', startTime: '15:00', endTime: '16:00' }),
  ], [], 'T-001', 'James Reyes', '2026-10-20'), /at most 8 schedule slots/);
});
