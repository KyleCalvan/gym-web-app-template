import { useMemo, useState, type FormEvent } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { getBookingCurrentTime, getBookingToday } from '../member/bookingDates.ts';
import { Badge, Field, Modal, TabbedCard } from '../shared';
import type { Session, TrainerAvailability, ViewProps } from '../types.ts';
import { validateAvailabilityChange, formatTime12h } from './availability.ts';

type CalendarView = 'day' | 'week' | 'month';
type AvailabilityForm = Pick<TrainerAvailability, 'date' | 'startTime' | 'endTime' | 'status'>;

const EMPTY_FORM: AvailabilityForm = {
  date: getBookingToday(),
  startTime: '09:00',
  endTime: '10:00',
  status: 'available',
};

function fromISODate(date: string): Date {
  return new Date(`${date}T12:00:00.000Z`);
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + amount);
  return result;
}

function getCalendarDates(anchorDate: string, view: CalendarView): string[] {
  const anchor = fromISODate(anchorDate);
  if (view === 'day') return [anchorDate];
  if (view === 'week') {
    const mondayOffset = (anchor.getUTCDay() + 6) % 7;
    return Array.from({ length: 7 }, (_, index) => toISODate(addDays(anchor, index - mondayOffset)));
  }

  const monthStart = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1, 12));
  const mondayOffset = (monthStart.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0)).getUTCDate();
  const cellCount = Math.ceil((mondayOffset + daysInMonth) / 7) * 7;
  return Array.from({ length: cellCount }, (_, index) =>
    toISODate(addDays(monthStart, index - mondayOffset)),
  );
}

function formatCalendarDate(date: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(fromISODate(date));
}

function shiftCalendarDate(date: string, view: CalendarView, direction: number): string {
  const shifted = fromISODate(date);
  if (view === 'month') shifted.setUTCMonth(shifted.getUTCMonth() + direction);
  else shifted.setUTCDate(shifted.getUTCDate() + direction * (view === 'week' ? 7 : 1));
  return toISODate(shifted);
}

function TrainerSchedule({
  sessions,
  trainerAvailability,
  setTrainerAvailability,
  currentUser,
  members,
  toast,
  addAudit,
}: Pick<ViewProps, 'sessions' | 'trainerAvailability' | 'setTrainerAvailability' | 'currentUser' | 'members' | 'toast' | 'addAudit'>) {
  const today = getBookingToday();
  const currentTime = getBookingCurrentTime();
  const trainerId = currentUser.id || currentUser.name;
  const trainerSessions = useMemo(
    () => sessions.filter((session) => session.trainer.trim().toLowerCase() === currentUser.name.trim().toLowerCase()),
    [sessions, currentUser.name],
  );
  const ownAvailability = useMemo(
    () => trainerAvailability
      .filter((schedule) => schedule.trainerId === trainerId)
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)),
    [trainerAvailability, trainerId],
  );

  const [view, setView] = useState<CalendarView>('month');
  const [anchorDate, setAnchorDate] = useState(today);
  const [selectedDate, setSelectedDate] = useState(today);
  const [availabilityModalOpen, setAvailabilityModalOpen] = useState(false);
  const [editing, setEditing] = useState<TrainerAvailability | null>(null);
  const [form, setForm] = useState<AvailabilityForm>({ ...EMPTY_FORM, date: today });
  const [formError, setFormError] = useState('');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [deleting, setDeleting] = useState<TrainerAvailability | null>(null);
  const dates = useMemo(() => getCalendarDates(anchorDate, view), [anchorDate, view]);

  const openScheduleForm = (schedule?: TrainerAvailability, date = selectedDate) => {
    setAvailabilityModalOpen(true);
    setEditing(schedule || null);
    setForm(schedule
      ? { date: schedule.date, startTime: schedule.startTime, endTime: schedule.endTime, status: schedule.status }
      : { ...EMPTY_FORM, date });
    setFormError('');
  };

  const saveAvailability = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const updated: TrainerAvailability = {
      id: editing?.id || crypto.randomUUID(),
      trainerId,
      ...form,
    };
    const next = editing
      ? trainerAvailability.map((schedule) => schedule.id === editing.id ? updated : schedule)
      : [...trainerAvailability, updated];
    const oldDateError = editing && editing.date !== updated.date
      ? validateAvailabilityChange(next, trainerSessions, trainerId, currentUser.name, editing.date)
      : null;
    const error = oldDateError
      || validateAvailabilityChange(next, trainerSessions, trainerId, currentUser.name, updated.date);
    if (error) {
      setFormError(error);
      return;
    }
    setTrainerAvailability(next);
    addAudit('info', editing ? 'Trainer availability updated' : 'Trainer availability added', `${updated.date} ${updated.startTime}–${updated.endTime} (${updated.status})`);
    toast(editing ? 'Availability updated' : 'Availability added');
    setEditing(null);
    setAvailabilityModalOpen(false);
  };

  const removeAvailability = () => {
    if (!deleting) return;
    const next = trainerAvailability.filter((schedule) => schedule.id !== deleting.id);
    const error = validateAvailabilityChange(next, trainerSessions, trainerId, currentUser.name, deleting.date);
    if (error) {
      toast(error);
      setDeleting(null);
      return;
    }
    setTrainerAvailability(next);
    addAudit('warn', 'Trainer availability removed', `${deleting.date} ${deleting.startTime}–${deleting.endTime}`);
    toast('Availability removed');
    setDeleting(null);
  };

  const changeView = (nextView: CalendarView) => {
    setView(nextView);
    setAnchorDate(selectedDate);
  };

  const moveCalendar = (direction: number) => {
    const next = shiftCalendarDate(anchorDate, view, direction);
    setAnchorDate(next);
    if (view === 'day') setSelectedDate(next);
  };

  const calendarTitle = view === 'month'
    ? formatCalendarDate(anchorDate, { month: 'long', year: 'numeric' })
    : view === 'week'
      ? `${formatCalendarDate(dates[0], { month: 'short', day: 'numeric' })} – ${formatCalendarDate(dates[6], { month: 'short', day: 'numeric', year: 'numeric' })}`
      : formatCalendarDate(anchorDate, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const daySessions = trainerSessions.filter((session) => session.date === selectedDate);
  const dayAvailability = ownAvailability.filter((schedule) => schedule.date === selectedDate);

  return (
    <>
      <TabbedCard title="TRAINER CALENDAR">
        <div className="trainer-calendar-toolbar">
          <div className="trainer-calendar-navigation">
            <button className="btn btn-outline btn-sm" type="button" onClick={() => moveCalendar(-1)} aria-label="Previous date range">
              <ChevronLeft size={16} />
            </button>
            <button className="btn btn-outline btn-sm" type="button" onClick={() => { setAnchorDate(today); setSelectedDate(today); }}>
              Today
            </button>
            <button className="btn btn-outline btn-sm" type="button" onClick={() => moveCalendar(1)} aria-label="Next date range">
              <ChevronRight size={16} />
            </button>
            <h3>{calendarTitle}</h3>
          </div>
          <div className="trainer-calendar-actions">
            <div className="trainer-calendar-view-switch" role="group" aria-label="Calendar view">
              {(['day', 'week', 'month'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={view === option ? 'selected' : ''}
                  aria-pressed={view === option}
                  onClick={() => changeView(option)}
                >
                  {option[0].toUpperCase() + option.slice(1)}
                </button>
              ))}
            </div>
            <button className="btn btn-signal btn-sm" type="button" onClick={() => openScheduleForm()}>
              <Plus size={15} /> Add availability
            </button>
          </div>
        </div>

        <div className={`trainer-calendar trainer-calendar-${view}`}>
          {view === 'month' && (
            <div className="trainer-calendar-weekdays" aria-hidden="true">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day}>{day}</span>)}
            </div>
          )}
          <div className={`trainer-calendar-grid trainer-calendar-grid-${view}`}>
            {dates.map((date) => {
              const sessionsOnDate = trainerSessions.filter((session) => session.date === date);
              const availabilityOnDate = ownAvailability.filter((schedule) => schedule.date === date);
              const isOutsideMonth = view === 'month' && date.slice(0, 7) !== anchorDate.slice(0, 7);
              const sessionLimit = view === 'month' ? 3 : 8;
              const availabilityLimit = view === 'month' ? 2 : 8;
              return (
                <div
                  key={date}
                  className={`trainer-calendar-day${date === selectedDate ? ' is-selected' : ''}${date === today ? ' is-today' : ''}${isOutsideMonth ? ' is-outside-month' : ''}`}
                >
                  <button
                    className="trainer-calendar-day-select"
                    type="button"
                    onClick={() => { setSelectedDate(date); if (isOutsideMonth) setAnchorDate(date); }}
                    aria-label={`Select ${formatCalendarDate(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}${sessionsOnDate.length ? `, ${sessionsOnDate.length} booking${sessionsOnDate.length === 1 ? '' : 's'}` : ''}`}
                    aria-pressed={date === selectedDate}
                  >
                    <span className="trainer-calendar-day-number">
                      {formatCalendarDate(date, { day: 'numeric' })}
                      {date === today && <small>Today</small>}
                    </span>
                  </button>
                  <span className="trainer-calendar-events">
                    {sessionsOnDate.slice(0, sessionLimit).map((session) => {
                      const cancelled = session.status === 'Cancelled';
                      return (
                        <button
                          type="button"
                          key={session.id}
                          className={`trainer-calendar-event ${cancelled ? 'event-cancelled' : 'event-booked'}`}
                          onClick={() => { setSelectedDate(date); setSelectedSession(session); }}
                          title={`${session.member} · ${formatTime12h(session.time)} · ${session.status}`}
                        >
                          <strong>{session.member}</strong><span>{formatTime12h(session.time)}</span>
                        </button>
                      );
                    })}
                    {availabilityOnDate.slice(0, availabilityLimit).map((schedule) => (
                      <button
                        type="button"
                        key={schedule.id}
                        className={`trainer-calendar-event ${schedule.status === 'available' ? 'event-available' : 'event-unavailable'}`}
                        title={`${schedule.status} · ${schedule.startTime}–${schedule.endTime}`}
                        onClick={() => openScheduleForm(schedule)}
                      >
                        <strong>{schedule.status === 'available' ? 'Available' : 'Unavailable'}</strong>
                        <span>{schedule.startTime}–{schedule.endTime}</span>
                      </button>
                    ))}
                    {(sessionsOnDate.length > sessionLimit || availabilityOnDate.length > availabilityLimit) && (
                      <span className="trainer-calendar-more">+ more</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="trainer-calendar-legend" aria-label="Calendar status legend">
          <span><i className="legend-booked" /> Booked</span>
          <span><i className="legend-cancelled" /> Cancelled</span>
          <span><i className="legend-available" /> Available</span>
          <span><i className="legend-unavailable" /> Unavailable</span>
        </div>

        <section className="trainer-selected-day" aria-live="polite">
          <div className="trainer-selected-day-heading">
            <div>
              <span>Selected date</span>
              <h3>{formatCalendarDate(selectedDate, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h3>
            </div>
            <button className="btn btn-outline btn-sm" type="button" onClick={() => openScheduleForm(undefined, selectedDate)}>
              <Plus size={14} /> Add time
            </button>
          </div>
          {daySessions.length === 0 && dayAvailability.length === 0 ? (
            <p className="trainer-calendar-empty">No bookings or availability set for this date.</p>
          ) : (
            <div className="trainer-selected-day-list">
              {daySessions.map((session) => (
                <button key={session.id} className="trainer-detail-row trainer-detail-booking" type="button" onClick={() => setSelectedSession(session)}>
                  <span className="trainer-detail-time">{formatTime12h(session.time)}</span>
                  <span><strong>{session.member}</strong><small>{session.type} · {session.id}</small></span>
                  <Badge status={session.status} />
                </button>
              ))}
              {dayAvailability.map((schedule) => (
                <div key={schedule.id} className={`trainer-detail-row trainer-detail-${schedule.status}`}>
                  <span className="trainer-detail-time">{schedule.startTime}–{schedule.endTime}</span>
                  <span><strong>{schedule.status === 'available' ? 'Available' : 'Unavailable'}</strong><small>Availability schedule</small></span>
                  <div className="trainer-detail-actions">
                    <button className="btn btn-outline btn-sm" type="button" onClick={() => openScheduleForm(schedule)} aria-label="Edit availability">
                      <Pencil size={14} /> Edit
                    </button>
                    <button className="btn btn-outline btn-sm trainer-delete-button" type="button" onClick={() => setDeleting(schedule)} aria-label="Remove availability">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </TabbedCard>

      <div className="trainer-availability-card">
        <div className="trainer-availability-heading">
          <div>
            <span>Availability management</span>
            <h2>EDIT SCHEDULES</h2>
            <p>Changes are checked against active bookings before they are saved.</p>
          </div>
          <CalendarDays size={20} aria-hidden="true" />
        </div>
        {ownAvailability.length === 0 ? (
          <p className="trainer-calendar-empty">No availability schedules yet. Add one to show open and blocked times on your calendar.</p>
        ) : (
          <div className="trainer-availability-list">
            {ownAvailability.map((schedule) => (
              <div className="trainer-availability-item" key={schedule.id}>
                <span className={`trainer-status-dot ${schedule.status}`} />
                <div className="trainer-availability-item-main">
                  <strong>{formatCalendarDate(schedule.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</strong>
                  <span>{schedule.startTime}–{schedule.endTime} · {schedule.status}</span>
                </div>
                <button className="btn btn-outline btn-sm" type="button" onClick={() => openScheduleForm(schedule)}>
                  <Pencil size={14} /> Edit
                </button>
                <button className="btn btn-outline btn-sm trainer-delete-button" type="button" onClick={() => setDeleting(schedule)} aria-label="Remove availability schedule">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {availabilityModalOpen && (
        <Modal title={editing ? 'EDIT AVAILABILITY' : 'ADD AVAILABILITY'} onClose={() => { setAvailabilityModalOpen(false); setEditing(null); setFormError(''); }} wide>
          <form className="trainer-availability-form" onSubmit={saveAvailability}>
            <Field label="Date">
              <input
                className="form-control"
                type="text"
                value={formatCalendarDate(form.date, { month: 'short', day: '2-digit', year: 'numeric' })}
                readOnly
                aria-readonly="true"
                title="Select a different calendar day before opening this form."
              />
            </Field>
            <div className="trainer-availability-time-fields">
              <Field label="Start time">
                <input className="form-control" type="time" min={form.date === today ? currentTime : undefined} value={form.startTime} onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))} required />
              </Field>
              <Field label="End time">
                <input className="form-control" type="time" value={form.endTime} onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))} required />
              </Field>
            </div>
            <Field label="Schedule status">
              <select className="form-control" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as TrainerAvailability['status'] }))}>
                <option value="available">Available</option>
                <option value="unavailable">Unavailable / Blocked</option>
              </select>
            </Field>
            {formError && <p className="trainer-validation-error" role="alert">{formError}</p>}
            <div className="trainer-modal-actions">
              <button className="btn btn-outline" type="button" onClick={() => { setAvailabilityModalOpen(false); setEditing(null); setFormError(''); }}>Close</button>
              <button className="btn btn-signal" type="submit">{editing ? 'Save changes' : 'Add availability'}</button>
            </div>
          </form>
        </Modal>
      )}

      {selectedSession && (
        <Modal title="BOOKING DETAILS" onClose={() => setSelectedSession(null)}>
          <div className="trainer-booking-modal">
            <div className="trainer-booking-member">
              <span>Client</span>
              <strong>{selectedSession.member}</strong>
              {members.find((member) => member.name.trim().toLowerCase() === selectedSession.member.trim().toLowerCase()) && (
                <small>
                  {members.find((member) => member.name.trim().toLowerCase() === selectedSession.member.trim().toLowerCase())?.email}
                  {' · '}
                  {members.find((member) => member.name.trim().toLowerCase() === selectedSession.member.trim().toLowerCase())?.phone}
                </small>
              )}
            </div>
            <dl>
              <div><dt>Date</dt><dd>{formatCalendarDate(selectedSession.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</dd></div>
              <div><dt>Session time</dt><dd>{formatTime12h(selectedSession.time)}</dd></div>
              <div><dt>Session type</dt><dd>{selectedSession.type}</dd></div>
              <div><dt>Booking reference</dt><dd>{selectedSession.id}</dd></div>
              <div><dt>Status</dt><dd><Badge status={selectedSession.status} /></dd></div>
            </dl>
          </div>
        </Modal>
      )}

      {deleting && (
        <Modal title="REMOVE AVAILABILITY?" onClose={() => setDeleting(null)}>
          <div className="trainer-booking-modal">
            <p>Remove {formatCalendarDate(deleting.date, { month: 'short', day: 'numeric', year: 'numeric' })}, {deleting.startTime}–{deleting.endTime}? Active bookings in this time will prevent removal.</p>
            <div className="trainer-modal-actions">
              <button className="btn btn-outline" type="button" onClick={() => setDeleting(null)}>Keep schedule</button>
              <button className="btn btn-danger" type="button" onClick={removeAvailability}>Remove schedule</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export default TrainerSchedule;
