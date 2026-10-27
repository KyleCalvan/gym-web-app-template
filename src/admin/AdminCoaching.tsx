import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge, Field, Select, TabbedCard } from '../shared';
import { getBookingToday } from '../member/bookingDates';
import { formatTime12h, timeInMinutes } from '../trainer/availability';
import type { ViewProps } from '../types';

type CalendarEntry = { id: string; date: string; time: string; sortTime: number; trainer: string; description: string; status: string; kind: 'booked' | 'cancelled' | 'available' | 'unavailable' | 'completed' };
function dateLabel(value: string, options: Intl.DateTimeFormatOptions) { return new Date(value + 'T12:00:00').toLocaleDateString('en-US', options); }
export default function AdminCoaching({ sessions, trainers, trainerAvailability }: Pick<ViewProps, 'sessions' | 'trainers' | 'trainerAvailability'>) {
  const [date, setDate] = useState(getBookingToday);
  const [trainerId, setTrainerId] = useState('all');
  const [status, setStatus] = useState('all');
  const [year, month] = date.split('-').map(Number);
  const activeTrainers = trainers.filter(trainer => !trainer.deletedAt);
  const visibleTrainers = activeTrainers.filter(trainer => trainerId === 'all' || trainer.id === trainerId);
  const entries = useMemo(() => {
    const visible = trainers.filter(trainer => !trainer.deletedAt && (trainerId === 'all' || trainer.id === trainerId));
    const names = new Set(visible.map(trainer => trainer.name.trim().toLowerCase()));
    const items: CalendarEntry[] = sessions.filter(session => names.has(session.trainer.trim().toLowerCase())).map(session => ({
      id: session.id, date: session.date.slice(0, 10), time: session.time, sortTime: timeInMinutes(session.time) ?? 0, trainer: session.trainer,
      description: session.type + ' · ' + session.member, status: session.status,
      kind: session.status === 'Cancelled' ? 'cancelled' : session.status === 'Completed' ? 'completed' : 'booked',
    }));
    for (const slot of trainerAvailability) {
      const trainer = visible.find(person => person.id === slot.trainerId);
      if (trainer) items.push({ id: slot.id, date: slot.date, sortTime: timeInMinutes(slot.startTime) ?? 0, time: formatTime12h(slot.startTime) + '–' + formatTime12h(slot.endTime), trainer: trainer.name, description: 'Trainer availability', status: slot.status === 'available' ? 'Available' : 'Unavailable', kind: slot.status });
    }
    return items.filter(item => status === 'all' || item.kind === status).sort((a,b) => a.date.localeCompare(b.date) || a.sortTime - b.sortTime);
  }, [sessions, trainers, trainerAvailability, trainerId, status]);
  const byDate = new Map<string, CalendarEntry[]>();
  for (const entry of entries) byDate.set(entry.date, [...(byDate.get(entry.date) || []), entry]);
  const offset = (new Date(year, month-1, 1).getDay()+6)%7;
  const days = new Date(year, month, 0).getDate();
  const cells = Array.from({length: Math.ceil((offset+days)/7)*7}, (_,index) => {
    const day=index-offset+1;
    return day>0 && day<=days ? year + '-' + String(month).padStart(2,'0') + '-' + String(day).padStart(2,'0') : null;
  });
  const shiftMonth = (delta: number) => {
    const next = new Date(year, month-1+delta, 1);
    setDate(next.getFullYear() + '-' + String(next.getMonth()+1).padStart(2,'0') + '-01');
  };
  const selected = byDate.get(date) || [];
  return <TabbedCard title="Trainer Availability">
    <div className="manager-calendar-controls">
      <Field label="Date"><input className="form-control" type="date" aria-label="Calendar date" value={date} onChange={event => { if(event.target.value) setDate(event.target.value); }} /></Field>
      <Field label="Trainer"><Select aria-label="Filter calendar by trainer" value={trainerId} onChange={setTrainerId}><option value="all">All trainers</option>{activeTrainers.map(trainer => <option key={trainer.id} value={trainer.id}>{trainer.name}</option>)}</Select></Field>
      <Field label="Show"><Select aria-label="Filter calendar by status" value={status} onChange={setStatus}>{['all','booked','cancelled','available','unavailable'].map(value => <option key={value} value={value}>{value === 'all' ? 'All statuses' : value[0].toUpperCase()+value.slice(1)}</option>)}</Select></Field>
    </div>
    <div className="trainer-calendar-toolbar">
      <div className="trainer-calendar-navigation"><button className="btn btn-ghost btn-sm" aria-label="Previous month" onClick={() => shiftMonth(-1)}><ChevronLeft size={18} /></button><h3 aria-live="polite">{dateLabel(date,{month:'long',year:'numeric'})}</h3><button className="btn btn-ghost btn-sm" aria-label="Next month" onClick={() => shiftMonth(1)}><ChevronRight size={18} /></button></div>
      <button className="btn btn-outline btn-sm" onClick={() => setDate(getBookingToday())}>Today</button>
    </div>
    <div className="manager-calendar" aria-label="All trainers schedule">
      {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => <span key={day} className="manager-calendar-weekday">{day}</span>)}
      {cells.map((iso,index) => iso ? <button key={iso} type="button" className={'manager-calendar-cell' + (date === iso ? ' is-selected' : '')} aria-pressed={date === iso} aria-current={iso === getBookingToday() ? 'date' : undefined} aria-label={iso + ', ' + (byDate.get(iso)?.length || 0) + ' schedule entries'} onClick={() => setDate(iso)}>
        <span className="manager-calendar-number">{Number(iso.slice(-2))}</span>
        {(byDate.get(iso) || []).slice(0,2).map(entry => <span key={entry.id} className={'manager-calendar-preview event-' + entry.kind}>{entry.time} · {entry.trainer}</span>)}
        {(byDate.get(iso)?.length || 0)>2 && <small>+{byDate.get(iso)!.length-2} more</small>}
      </button> : <span key={'blank'+index} className="manager-calendar-cell is-empty" />)}
    </div>
    <section className="trainer-selected-day manager-calendar-detail" aria-label="Selected trainer schedule">
      <div className="trainer-selected-day-heading"><div><h3>{dateLabel(date,{weekday:'long',month:'long',day:'numeric'})}</h3><p>{selected.length} entries · {visibleTrainers.length} trainer{visibleTrainers.length === 1 ? '' : 's'}</p></div></div>
      {selected.length ? <div className="trainer-selected-day-list">{selected.map(entry => <div className="trainer-detail-row" key={entry.id}><span className="trainer-detail-time">{entry.time}</span><span><strong>{entry.trainer}</strong><small>{entry.description}</small></span><Badge status={entry.status} /></div>)}</div> : <p className="distribution-empty">No availability or bookings recorded for this date.</p>}
    </section>
  </TabbedCard>;
}
