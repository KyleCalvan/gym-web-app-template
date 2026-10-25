import test from 'node:test';
import assert from 'node:assert/strict';
import { memberSessionsByDate } from '../src/member/calendarEvents.ts';
const session = (id, member, status, date = '2026-10-25', time = '09:00') => ({ id, member, status, date, time, trainer: 'Coach', type: 'Coaching', paid: true });
test('member calendar excludes other members, cancelled sessions, and unknown identity', () => {
 const entries = [session('a','Maria','Confirmed'), session('b','Other','Confirmed'), session('c','Maria','Cancelled')];
 assert.deepEqual(memberSessionsByDate(entries,'Maria').get('2026-10-25').map(s=>s.id), ['a']);
 assert.equal(memberSessionsByDate(entries,undefined).size, 0);
});
test('calendar groups supported session states by day and sorts without mutating the store', () => {
 const entries = [session('a','Maria','Pending','2026-10-25','15:00'),session('b','Maria','Completed','2026-10-25','09:00'),session('c','Maria','Confirmed','2026-10-26')];
 const days = memberSessionsByDate(entries,'Maria');
 assert.equal(days.size,2);
 assert.deepEqual(days.get('2026-10-25').map(s=>s.id),['b','a']);
 assert.deepEqual(entries.map(s=>s.id),['a','b','c']);
});
