import { useMemo, useState } from 'react';
import { CalendarDays, UsersRound } from 'lucide-react';
import { Badge, Field, Select, TabbedCard } from '../shared';
import type { Session, Trainer, TrainerAvailability, ViewProps } from '../types.ts';

type AvailabilityFilter = 'all' | 'booked' | 'cancelled' | 'available' | 'unavailable';

function getToday(): string {
  const timeZone = process.env.NEXT_PUBLIC_BOOKING_TIME_ZONE || 'Asia/Manila';
  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => {
    const part = parts.find((entry) => entry.type === type)?.value;
    if (!part) throw new Error(`Unable to determine ${type} in ${timeZone}.`);
    return part;
  };
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function formatDate(value: string): string {
  if (!value) return 'Select a date';
  const date = new Date(`${value}T12:00:00.000Z`);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function AdminCoaching({
  sessions,
  trainers,
  trainerAvailability,
}: Pick<ViewProps, 'sessions' | 'trainers' | 'trainerAvailability'>) {
  const [date, setDate] = useState(getToday);
  const [trainerId, setTrainerId] = useState('all');
  const [status, setStatus] = useState<AvailabilityFilter>('all');

  const selectedTrainer = trainers.find((trainer) => trainer.id === trainerId);
  const selectedTrainerName = selectedTrainer?.name.toLowerCase();

  const dayBookings = useMemo(() => sessions.filter((session) => {
    if (session.date !== date) return false;
    return !selectedTrainerName || session.trainer.trim().toLowerCase() === selectedTrainerName;
  }), [sessions, date, selectedTrainerName]);

  const dayAvailability = useMemo(() => trainerAvailability.filter((schedule) => {
    if (schedule.date !== date) return false;
    return trainerId === 'all' || schedule.trainerId === trainerId;
  }), [trainerAvailability, date, trainerId]);

  const filteredBookings = dayBookings.filter((session) => {
    if (status === 'booked') return session.status !== 'Cancelled' && session.status !== 'Completed';
    if (status === 'cancelled') return session.status === 'Cancelled';
    return status === 'all';
  });
  const filteredAvailability = dayAvailability.filter((schedule) =>
    status === 'all' || status === schedule.status,
  );
  const activeBookings = dayBookings.filter((session) =>
    session.status !== 'Cancelled' && session.status !== 'Completed',
  ).length;
  const cancelledBookings = dayBookings.filter((session) => session.status === 'Cancelled').length;

  return (
    <TabbedCard title="Trainer Availability">
      <div className="admin-availability-filters">
        <Field label="Date">
          <input className="form-control" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field label="Trainer">
          <Select value={trainerId} onChange={setTrainerId}>
            <option value="all">All trainers</option>
            {trainers.filter((trainer) => !trainer.deletedAt).map((trainer) => (
              <option key={trainer.id} value={trainer.id}>{trainer.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Show">
          <Select value={status} onChange={(value) => setStatus(value as AvailabilityFilter)}>
            <option value="all">All statuses</option>
            <option value="booked">Booked</option>
            <option value="cancelled">Cancelled</option>
            <option value="available">Available</option>
            <option value="unavailable">Unavailable</option>
          </Select>
        </Field>
      </div>

      <div className="admin-availability-summary">
        <div><CalendarDays size={17} /><span><strong>{activeBookings}</strong> active bookings</span></div>
        <div><UsersRound size={17} /><span><strong>{cancelledBookings}</strong> cancelled</span></div>
        <span className="admin-availability-date">{formatDate(date)}</span>
      </div>

      <div className="admin-availability-grid">
        {trainers.filter((trainer) => !trainer.deletedAt && (trainerId === 'all' || trainer.id === trainerId)).map((trainer: Trainer) => {
          const bookings = filteredBookings.filter((session: Session) =>
            session.trainer.trim().toLowerCase() === trainer.name.trim().toLowerCase(),
          ).sort((a, b) => a.time.localeCompare(b.time));
          const schedules = filteredAvailability.filter((schedule: TrainerAvailability) => schedule.trainerId === trainer.id)
            .sort((a, b) => a.startTime.localeCompare(b.startTime));

          if (status === 'booked' || status === 'cancelled') {
            if (!bookings.length) return null;
          } else if (status === 'available' || status === 'unavailable') {
            if (!schedules.length) return null;
          } else if (!bookings.length && !schedules.length) {
            return (
              <article className="admin-availability-trainer" key={trainer.id}>
                <header><div><strong>{trainer.name}</strong><small>{trainer.specialty}</small></div><span className="admin-availability-state">No schedule set</span></header>
                <p>No availability or bookings recorded for this date.</p>
              </article>
            );
          }

          return (
            <article className="admin-availability-trainer" key={trainer.id}>
              <header>
                <div><strong>{trainer.name}</strong><small>{trainer.specialty}</small></div>
                <span className="admin-availability-state">{bookings.length} booking{bookings.length === 1 ? '' : 's'} · {schedules.length} slot{schedules.length === 1 ? '' : 's'}</span>
              </header>
              <div className="admin-availability-items">
                {bookings.map((session: Session) => (
                  <div className={`admin-availability-item ${session.status === 'Cancelled' ? 'is-cancelled' : 'is-booked'}`} key={session.id}>
                    <span className="admin-availability-time">{session.time}</span>
                    <span className="admin-availability-item-copy"><strong>{session.member}</strong><small>{session.type} · {session.id}</small></span>
                    <Badge status={session.status} />
                  </div>
                ))}
                {schedules.map((schedule: TrainerAvailability) => (
                  <div className={`admin-availability-item ${schedule.status === 'available' ? 'is-available' : 'is-unavailable'}`} key={schedule.id}>
                    <span className="admin-availability-time">{schedule.startTime}–{schedule.endTime}</span>
                    <span className="admin-availability-item-copy"><strong>{schedule.status === 'available' ? 'Available' : 'Unavailable'}</strong><small>Trainer schedule</small></span>
                    <span className={`admin-availability-state state-${schedule.status}`}>{schedule.status}</span>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>

      {filteredBookings.length === 0 && filteredAvailability.length === 0 && (
        <p className="admin-availability-empty">No {status === 'all' ? 'availability or bookings' : status} found for {formatDate(date)}.</p>
      )}
    </TabbedCard>
  );
}

export default AdminCoaching;
