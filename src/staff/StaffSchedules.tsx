// @ts-nocheck
import { TabbedCard } from '../shared';
import { getBookingToday } from '../member/bookingDates';
import { formatTime12h } from '../trainer/availability';

function StaffSchedules({ trainers, trainerAvailability }) {
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat'];
  const today = getBookingToday();
  const monday = new Date(`${today}T12:00:00.000Z`);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const dates = days.map((_, index) => {
    const date = new Date(monday);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
  return (
    <TabbedCard title="Weekly Trainer Schedule (View Only)">
      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th>Trainer</th>{days.map(d=><th key={d}>{d}</th>)}</tr></thead>
          <tbody>
            {trainers.map(t=>(
              <tr key={t.id}>
                <td>{t.name}<div className="mono" style={{fontSize:11.6, color:'var(--steel)'}}>{t.specialty}</div></td>
                {dates.map((date)=><td key={date} className="mono" style={{fontSize:12.7}}>{
                  trainerAvailability.filter((slot) => slot.trainerId === t.id && slot.date === date && slot.status === 'available')
                    .map((slot) => `${formatTime12h(slot.startTime)}–${formatTime12h(slot.endTime)}`).join(', ') || '—'
                }</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TabbedCard>
  );
}

export default StaffSchedules;
