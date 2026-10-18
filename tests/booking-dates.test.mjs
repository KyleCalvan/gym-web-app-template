import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getBookingDateError,
  getBookingDatesError,
  getBookingToday,
  isBookingSlotAvailable,
} from '../src/member/bookingDates.ts';

test('booking today uses the configured timezone instead of the host timezone', () => {
  const now = new Date('2026-10-17T16:30:00.000Z');
  assert.equal(getBookingToday(now, 'Asia/Manila'), '2026-10-18');
  assert.equal(getBookingToday(now, 'America/Los_Angeles'), '2026-10-17');
});

test('date validation allows today and future dates, and rejects past or invalid dates', () => {
  assert.equal(getBookingDateError('2026-10-18', '2026-10-18'), null);
  assert.equal(getBookingDateError('2026-10-19', '2026-10-18'), null);
  assert.match(getBookingDateError('2026-10-17', '2026-10-18'), /today or a future date/);
  assert.match(getBookingDateError('2026-02-30', '2026-02-01'), /valid session date/);
});

test('date-list validation rejects empty, past, and duplicate dates', () => {
  assert.match(getBookingDatesError([], '2026-10-18'), /at least one/);
  assert.match(getBookingDatesError(['2026-10-17'], '2026-10-18'), /today or a future date/);
  assert.match(getBookingDatesError(['2026-10-18', '2026-10-18'], '2026-10-18'), /only be added once/);
  assert.equal(getBookingDatesError(['2026-10-18', '2026-10-19'], '2026-10-18'), null);
});

test('slot availability blocks active duplicate trainer slots across time formats', () => {
  const bookings = [
    { id: 'active', trainer: 'James Reyes', date: '2026-10-20', time: '7:00 AM', status: 'Confirmed' },
    { id: 'cancelled', trainer: 'James Reyes', date: '2026-10-20', time: '8:00 AM', status: 'Cancelled' },
  ];
  assert.equal(isBookingSlotAvailable(bookings, {
    trainer: 'James Reyes', date: '2026-10-20', time: '07:00',
  }), false);
  assert.equal(isBookingSlotAvailable(bookings, {
    trainer: 'James Reyes', date: '2026-10-20', time: '08:00',
  }), true);
  assert.equal(isBookingSlotAvailable(bookings, {
    trainer: 'James Reyes', date: '2026-10-20', time: '07:00', excludeBookingId: 'active',
  }), true);
});
