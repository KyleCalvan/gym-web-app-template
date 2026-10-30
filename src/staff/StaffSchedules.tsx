'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TabbedCard } from '../shared';
import { getBookingToday } from '../member/bookingDates';
import { formatTime12h } from '../trainer/availability';
import type { Trainer, TrainerAvailability } from '../types';

type CalendarView = 'day' | 'week' | 'month';
type Props = { trainers: Trainer[]; trainerAvailability: TrainerAvailability[]; embedded?: boolean };

function fromDate(value: string) { return new Date(`${value}T12:00:00.000Z`); }
function isoDate(value: Date) { return value.toISOString().slice(0, 10); }
function addDays(value: Date, amount: number) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return date;
}
function calendarDates(anchor: string, view: CalendarView) {
  const date = fromDate(anchor);
  if (view === 'day') return [anchor];
  if (view === 'week') {
    const mondayOffset = (date.getUTCDay() + 6) % 7;
    return Array.from({ length: 7 }, (_, index) => isoDate(addDays(date, index - mondayOffset)));
  }
  const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 12));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const cells = Math.ceil((mondayOffset + daysInMonth) / 7) * 7;
  return Array.from({ length: cells }, (_, index) => isoDate(addDays(first, index - mondayOffset)));
}
function labelDate(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(fromDate(value));
}
function moveDate(value: string, view: CalendarView, direction: number) {
  const date = fromDate(value);
  if (view === 'month') return isoDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + direction, 1, 12)));
  date.setUTCDate(date.getUTCDate() + direction * (view === 'week' ? 7 : 1));
  return isoDate(date);
}

export default function StaffSchedules({ trainers, trainerAvailability, embedded = false }: Props) {
  const today = getBookingToday();
  const [view, setView] = useState<CalendarView>('month');
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState(today);
  const dates = useMemo(() => calendarDates(anchor, view), [anchor, view]);
  const trainerById = useMemo(() => new Map(trainers.filter(trainer => !trainer.deletedAt)
    .map(trainer => [trainer.id, trainer])), [trainers]);
  const slotsByDate = useMemo(() => {
    const grouped = new Map<string, { trainer: Trainer; slot: TrainerAvailability }[]>();
    for (const slot of trainerAvailability) {
      const trainer = trainerById.get(slot.trainerId);
      if (!trainer) continue;
      const entries = grouped.get(slot.date) ?? [];
      entries.push({ trainer, slot });
      grouped.set(slot.date, entries);
    }
    for (const entries of grouped.values()) entries.sort((a, b) =>
      a.slot.startTime.localeCompare(b.slot.startTime) || a.trainer.name.localeCompare(b.trainer.name));
    return grouped;
  }, [trainerAvailability, trainerById]);
  const selectedSlots = slotsByDate.get(selected) ?? [];
  const title = view === 'month'
    ? labelDate(anchor, { month: 'long', year: 'numeric' })
    : view === 'week'
      ? `${labelDate(dates[0], { month: 'short', day: 'numeric' })} – ${labelDate(dates[6], { month: 'short', day: 'numeric', year: 'numeric' })}`
      : labelDate(anchor, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const calendar = <div className="staff-trainer-calendar">
    <div className="trainer-calendar-toolbar">
      <div className="trainer-calendar-navigation">
        <button className="btn btn-outline btn-sm" type="button" aria-label="Previous date range"
          onClick={() => { const next = moveDate(anchor, view, -1); setAnchor(next); if (view === 'day') setSelected(next); }}>
          <ChevronLeft size={16} />
        </button>
        <button className="btn btn-outline btn-sm" type="button" onClick={() => { setAnchor(today); setSelected(today); }}>Today</button>
        <button className="btn btn-outline btn-sm" type="button" aria-label="Next date range"
          onClick={() => { const next = moveDate(anchor, view, 1); setAnchor(next); if (view === 'day') setSelected(next); }}>
          <ChevronRight size={16} />
        </button>
        <h3>{title}</h3>
      </div>
      <div className="trainer-calendar-view-switch" role="group" aria-label="Calendar view">
        {(['day', 'week', 'month'] as const).map(option => <button key={option} type="button"
          className={view === option ? 'selected' : ''} aria-pressed={view === option}
          onClick={() => { setView(option); setAnchor(selected); }}>
          {option[0].toUpperCase() + option.slice(1)}
        </button>)}
      </div>
    </div>
    <div className={`trainer-calendar trainer-calendar-${view}`}>
      {view === 'month' && <div className="trainer-calendar-weekdays" aria-hidden="true">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day}>{day}</span>)}
      </div>}
      <div className={`trainer-calendar-grid trainer-calendar-grid-${view}`}>
        {dates.map(date => {
          const entries = slotsByDate.get(date) ?? [];
          const outside = view === 'month' && date.slice(0, 7) !== anchor.slice(0, 7);
          return <button key={date} type="button"
            className={`trainer-calendar-day staff-trainer-day${date === selected ? ' is-selected' : ''}${date === today ? ' is-today' : ''}${outside ? ' is-outside-month' : ''}`}
            aria-label={`${labelDate(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}, ${entries.length} trainer schedule${entries.length === 1 ? '' : 's'}`}
            aria-pressed={date === selected}
            onClick={() => { setSelected(date); if (outside) setAnchor(date); }}>
            <span className="trainer-calendar-day-number">{labelDate(date, { day: 'numeric' })}{date === today && <small>Today</small>}</span>
            <span className="staff-trainer-day-events">
              {entries.slice(0, view === 'month' ? 2 : 6).map(({ trainer, slot }) =>
                <span key={slot.id} className={`staff-trainer-slot ${slot.status}`}>
                  <strong>{trainer.name}</strong><span>{formatTime12h(slot.startTime)}–{formatTime12h(slot.endTime)}</span>
                </span>)}
              {entries.length > (view === 'month' ? 2 : 6) && <span className="trainer-calendar-more">+{entries.length - (view === 'month' ? 2 : 6)} more</span>}
            </span>
          </button>;
        })}
      </div>
    </div>
    <section className="trainer-selected-day" aria-live="polite">
      <div className="trainer-selected-day-heading"><div><span>Selected date · View only</span>
        <h3>{labelDate(selected, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h3>
      </div></div>
      {selectedSlots.length === 0
        ? <p className="trainer-calendar-empty">No trainer schedule is set for this date.</p>
        : <div className="trainer-selected-day-list">
          {selectedSlots.map(({ trainer, slot }) => <div key={slot.id} className="trainer-detail-row staff-trainer-detail">
            <span className="trainer-detail-time">{formatTime12h(slot.startTime)}–{formatTime12h(slot.endTime)}</span>
            <span><strong>{trainer.name}</strong><small>{trainer.specialty || 'Trainer'}</small></span>
            <span className={`staff-trainer-status ${slot.status}`}>{slot.status}</span>
          </div>)}
        </div>}
    </section>
  </div>;

  return embedded ? calendar : <TabbedCard title="Trainer Calendar (View Only)">{calendar}</TabbedCard>;
}
