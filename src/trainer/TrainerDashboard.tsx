import { useEffect, useState } from 'react';
import { StatTile, TabbedCard, Table, Badge } from '../shared';
import type { ViewProps } from '../types.ts';
import { formatTime12h } from './availability.ts';
import { trainerDashboardData, type TrainerDashboardSession } from './dashboardData.ts';

type DashboardProps = Partial<Pick<ViewProps, 'sessions'>> & { databaseMode?: boolean };

export default function TrainerDashboard({ sessions = [], databaseMode = false }: DashboardProps) {
  const [savedSessions, setSavedSessions] = useState<TrainerDashboardSession[]>([]);
  const [loading, setLoading] = useState(databaseMode);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!databaseMode) return;
    const controller = new AbortController();
    fetch('/api/trainer/sessions', { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Dashboard could not be loaded.');
        return data as { sessions: TrainerDashboardSession[] };
      })
      .then(data => { setSavedSessions(data.sessions); setLoading(false); setError(''); })
      .catch(cause => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : 'Dashboard could not be loaded.');
        setLoading(false);
      });
    return () => controller.abort();
  }, [databaseMode, attempt]);

  const data = trainerDashboardData(databaseMode ? savedSessions : sessions);
  const todayLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${data.today}T12:00:00.000Z`)).toUpperCase();

  if (databaseMode && loading) return <p role="status">Loading trainer dashboard…</p>;
  if (databaseMode && error) return <p role="alert">{error} <button type="button" onClick={() => { setLoading(true); setAttempt(value => value + 1); }}>Retry</button></p>;

  return <>
    <div className="grid grid-4" style={{ marginBottom: 18 }}>
      <StatTile label="Sessions Today" value={data.sessionsToday} tone="court" />
      <StatTile label="This Week" value={data.thisWeekCount} tone="amber" />
      <StatTile label="Avg. Rating" value={'★ ' + data.avgRating} />
      <StatTile label="Upcoming" value={data.upcomingCount} tone="steel" />
    </div>

    <TabbedCard title={`YOUR SESSIONS — ${todayLabel}`}>
      {data.todays.length === 0
        ? <p>No sessions scheduled today.</p>
        : <Table columns={['TIME', 'MEMBER', 'TYPE', 'STATUS']} rows={data.todays} renderRow={session => (
          <tr key={session.id}>
            <td className="mono">{formatTime12h(session.time)}</td>
            <td>{session.member}</td>
            <td>{session.type}</td>
            <td><Badge status={session.status} /></td>
          </tr>
        )} />}
    </TabbedCard>
  </>;
}
