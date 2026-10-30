import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import StaffSchedules from '../src/staff/StaffSchedules';
import StaffPOS from '../src/staff/StaffPOS';
import { getBookingToday } from '../src/member/bookingDates';
import type { Trainer, TrainerAvailability } from '../src/types';

const today = getBookingToday();
const trainers = [
  { id: 'trainer-a', name: 'Alice Coach', specialty: 'Strength' },
  { id: 'trainer-b', name: 'Bob Trainer', specialty: 'Mobility' },
] as Trainer[];
const availability: TrainerAvailability[] = [
  { id: 'slot-a', trainerId: 'trainer-a', date: today, startTime: '09:00', endTime: '10:00', status: 'available' },
  { id: 'slot-b', trainerId: 'trainer-b', date: today, startTime: '11:00', endTime: '12:00', status: 'unavailable' },
];

test('staff calendar shows each trainer and status for the selected day without edit controls', () => {
  const html = renderToStaticMarkup(createElement(StaffSchedules,
    { trainers, trainerAvailability: availability }));
  assert.match(html, /Trainer Calendar \(View Only\)/);
  assert.match(html, /Alice Coach/);
  assert.match(html, /Bob Trainer/);
  assert.match(html, /9:00 AM/);
  assert.match(html, /11:00 AM/);
  assert.match(html, /unavailable/);
  assert.doesNotMatch(html, /Add availability|Save availability|Delete availability/);
});

test('staff POS includes the read-only calendar', () => {
  const html = renderToStaticMarkup(createElement(StaffPOS, {
    members: [], plans: [], trainers, trainerAvailability: availability, toast: () => {},
  }));
  assert.match(html, /Trainer schedules · View only/);
  assert.match(html, /Alice Coach/);
  assert.doesNotMatch(html, /Add availability|Save availability|Delete availability/);
});
