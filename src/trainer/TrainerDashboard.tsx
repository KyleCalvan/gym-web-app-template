// @ts-nocheck
import { StatTile, TabbedCard, Table, Badge } from '../shared';
import { formatTime12h } from './availability.ts';
import { getBookingToday } from '../member/bookingDates.ts';

function TrainerDashboard({ sessions, today: todayLabel }) {
  const todayDate = new Date();
  const today = getBookingToday();
  const todays = sessions.filter((s) => s.date === today);

  // This week = next 7 days, including today.
  const inAWeek = new Date(todayDate);
  inAWeek.setDate(inAWeek.getDate() + 7);
  const weekEnd = inAWeek.toISOString().slice(0, 10);
  const thisWeek = sessions.filter((s) => {
    if (!s.date) return false;
    return s.date >= today && s.date <= weekEnd;
  });

  // Upcoming = future sessions, sorted ascending.
  const upcoming = sessions
    .filter((s) => {
      if (!s.date) return false;
      return s.date >= today;
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Average rating across this trainer's sessions.
  const rated = sessions.filter((s) => typeof s.rating === 'number');
  const avg = rated.length
    ? rated.reduce((sum, s) => sum + s.rating, 0) / rated.length
    : 0;

  const sessionsToday = todays.length;
  const thisWeekCount = thisWeek.length;
  const upcomingCount = upcoming.length;
  const avgDisplay = rated.length ? avg.toFixed(1) : '—';

  const todayLong = todayDate.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).toUpperCase();

  return (
    <>
      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <StatTile label="Sessions Today" value={sessionsToday} tone="court" />
        <StatTile label="This Week"     value={thisWeekCount} tone="amber" />
        <StatTile
          label="Avg. Rating"
          value={'★ ' + avgDisplay}
        />
        <StatTile label="Upcoming" value={upcomingCount} tone="steel" />
      </div>

      <TabbedCard title={`YOUR SESSIONS — ${todayLong}`}>
        <Table
          columns={['TIME', 'MEMBER', 'TYPE', 'STATUS']}
          rows={todays}
          renderRow={(s) => (
            <tr key={s.id}>
              <td className="mono">{formatTime12h(s.time)}</td>
              <td>{s.member}</td>
              <td>{s.type}</td>
              <td><Badge status={s.status} /></td>
            </tr>
          )}
        />
      </TabbedCard>
    </>
  );
}

export default TrainerDashboard;
