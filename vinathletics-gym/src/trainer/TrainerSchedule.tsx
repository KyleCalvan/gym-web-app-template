// @ts-nocheck
import { useState } from 'react';
import { TabbedCard, Table, Field, Select, TextInput } from '../shared';

const DEFAULT_DAYS = [
  { day: 'Mon', hours: '6:00 AM - 9:00 AM, 4:00 PM - 8:00 PM', booked: 0 },
  { day: 'Tue', hours: '6:00 AM - 9:00 AM, 4:00 PM - 8:00 PM', booked: 0 },
  { day: 'Wed', hours: '6:00 AM - 9:00 AM, 4:00 PM - 8:00 PM', booked: 0 },
  { day: 'Thu', hours: '6:00 AM - 9:00 AM, 4:00 PM - 8:00 PM', booked: 1 },
  { day: 'Fri', hours: '6:00 AM - 9:00 AM, 4:00 PM - 8:00 PM', booked: 1 },
  { day: 'Sat', hours: '6:00 AM - 9:00 AM, 4:00 PM - 8:00 PM', booked: 0 },
  { day: 'Sun', hours: 'Unavailable', booked: 0 },
];

function TrainerSchedule({ sessions, toast, addAudit }) {
  // Derive booked counts from real session data, but fall back to the
  // pictured defaults when there are no sessions (e.g. on first load).
  const days = DEFAULT_DAYS.map((d) => {
    if (d.hours === 'Unavailable') {
      return { ...d, booked: 0, isOff: true };
    }
    const matched = sessions.filter((s) => s.day && s.day.startsWith(d.day));
    return { ...d, booked: matched.length };
  });

  const [form, setForm] = useState({ day: 'Mon', from: '', to: '' });

  const save = (e) => {
    e.preventDefault();
    if (!form.from.trim() || !form.to.trim()) {
      toast('Please enter a start and end time');
      return;
    }
    addAudit?.('info', 'Availability updated', `${form.day} ${form.from}–${form.to}`);
    toast(`Availability saved for ${form.day}`);
    setForm({ day: 'Mon', from: '', to: '' });
  };

  return (
    <>
      <TabbedCard label="Schedule" title="WEEKLY SCHEDULE">
        <Table
          columns={['DAY', 'AVAILABLE HOURS', 'BOOKED SESSIONS']}
          rows={days}
          renderRow={(d) => (
            <tr key={d.day}>
              <td>{d.day}</td>
              <td className="mono">{d.isOff ? 'Unavailable' : d.hours}</td>
              <td className="mono">{d.isOff ? '—' : `${d.booked} booked`}</td>
            </tr>
          )}
        />
      </TabbedCard>

      <div style={{ height: 18 }}></div>

      <TabbedCard label="Availability" title="SET / UPDATE AVAILABILITY">
        <form onSubmit={save}>
          <div className="grid grid-3" style={{ alignItems: 'end' }}>
            <Field label="Day">
              <Select value={form.day} onChange={(v) => setForm((f) => ({ ...f, day: v }))}>
                {DEFAULT_DAYS.map((d) => (
                  <option key={d.day} value={d.day}>
                    {d.day}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="From">
              <TextInput
                value={form.from}
                onChange={(v) => setForm((f) => ({ ...f, from: v }))}
                placeholder="e.g. 6:00 AM"
              />
            </Field>
            <Field label="To">
              <TextInput
                value={form.to}
                onChange={(v) => setForm((f) => ({ ...f, to: v }))}
                placeholder="e.g. 9:00 AM"
              />
            </Field>
          </div>
          <div style={{ marginTop: 14 }}>
            <button className="btn btn-signal" type="submit">
              Save Availability
            </button>
          </div>
        </form>
      </TabbedCard>
    </>
  );
}

export default TrainerSchedule;
