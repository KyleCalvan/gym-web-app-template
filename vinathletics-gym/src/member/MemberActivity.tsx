// @ts-nocheck
import { useMemo, useState } from 'react';
import { Badge, BarChart, StatTile, TabbedCard, Table } from '../shared';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

const todayISO = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const nowHHMM = (): string => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};

function MemberActivity({
  members, sessions, currentUserId,
  checkInHistory, setCheckInHistory, setCheckIns, toast,
}) {
  const me = members.find(m => m.id === currentUserId) || members[0];
  const myId = me?.id || 'M-1042';

  const checkedToday = useMemo(
    () => checkInHistory.some(r => r.memberId === myId && r.date === todayISO()),
    [checkInHistory, myId],
  );
  const isFrozen = me?.status === 'Frozen';

  const myHistory = useMemo(
    () => checkInHistory.filter(r => r.memberId === myId),
    [checkInHistory, myId],
  );
  const historyByDate = useMemo(() => {
    const m = new Map();
    myHistory.forEach(r => m.set(r.date, r));
    return m;
  }, [myHistory]);

  // Calendar view state
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Build calendar grid (Mon-first, 42 cells)
  const grid = useMemo(() => {
    const first = new Date(viewMonth.year, viewMonth.month, 1);
    const daysInMonth = new Date(viewMonth.year, viewMonth.month + 1, 0).getDate();
    // Mon-first offset: 0=Mon ... 6=Sun. JS: Sun=0, Mon=1, ..., Sat=6.
    const jsDow = first.getDay(); // Sun=0
    const offset = (jsDow + 6) % 7;
    const cells = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const m = String(viewMonth.month + 1).padStart(2, '0');
      const day = String(d).padStart(2, '0');
      cells.push(`${viewMonth.year}-${m}-${day}`);
    }
    while (cells.length < 42) cells.push(null);
    return cells;
  }, [viewMonth]);

  // Streak: consecutive days ending today (or yesterday if not today yet).
  const streak = useMemo(() => {
    const dates = new Set(myHistory.map(r => r.date));
    if (dates.size === 0) return 0;
    let count = 0;
    const cursor = new Date();
    // Allow streak if today OR yesterday is in dates.
    if (!dates.has(toISO(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
      if (!dates.has(toISO(cursor))) return 0;
    }
    while (dates.has(toISO(cursor))) {
      count++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }, [myHistory]);

  // Monthly check-in count (real data).
  const monthCheckIns = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    return myHistory.filter(r => r.date.startsWith(ym)).length;
  }, [myHistory]);

  // Real weekly chart for current month (Week 1..4 by 7-day chunks ending today).
  const weeklyData = useMemo(() => {
    const now = new Date();
    const buckets = [0, 0, 0, 0]; // Wk1..Wk4
    myHistory.forEach(r => {
      const d = new Date(r.date);
      const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
      if (diffDays < 0 || diffDays > 28) return;
      const idx = Math.min(3, Math.floor(diffDays / 7));
      buckets[idx]++;
    });
    return [
      { d: 'Wk1', v: buckets[0] },
      { d: 'Wk2', v: buckets[1] },
      { d: 'Wk3', v: buckets[2] },
      { d: 'Wk4', v: buckets[3] },
    ];
  }, [myHistory]);

  // Coaching session log (filter sessions for me).
  const mySessions = useMemo(
    () => sessions
      .filter(s => s.member === me?.name)
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [sessions, me?.name],
  );

  const handleCheckIn = () => {
    if (isFrozen) { toast('Frozen accounts cannot check in.'); return; }
    if (checkedToday) { toast('Already checked in today.'); return; }
    const date = todayISO();
    const time = nowHHMM();
    setCheckInHistory(prev => [...prev, {
      id: `CKI-${myId}-${Date.now()}`,
      memberId: myId,
      date,
      time,
    }]);
    setCheckIns(c => ({ ...c, count: c.count + 1 }));
    toast('Checked in — see you at the gym!');
    setSelectedDay(date);
  };

  return (
    <>
      <div className="grid grid-4" style={{marginBottom:18}}>
        <StatTile label="Check-ins This Month" value={monthCheckIns} tone="court" />
        <StatTile label="Total Check-ins" value={myHistory.length} />
        <StatTile label="Current Streak" value={`${streak} day${streak === 1 ? '' : 's'}`} tone="amber" />
        <StatTile label="Coaching Sessions" value={mySessions.length} tone="steel" />
      </div>

      {isFrozen && (
        <TabbedCard label="Notice" title="">
          <div style={{display:'flex', alignItems:'center', gap:12}}>
            <Badge status="Frozen" />
            <div style={{fontSize:13, color:'var(--steel)'}}>
              Your account is currently frozen. Check-in is paused. Contact admin to unfreeze.
            </div>
          </div>
        </TabbedCard>
      )}
      {isFrozen && <div style={{height:18}}></div>}

      <TabbedCard
        label="Activity"
        title="📅 Check-in Calendar"
        right={
          <button
            className="btn btn-signal btn-sm"
            onClick={handleCheckIn}
            disabled={isFrozen || checkedToday}
            title={isFrozen ? 'Frozen accounts cannot check in' : (checkedToday ? 'Already checked in today' : 'Tap to record today\'s visit')}
          >
            {checkedToday ? 'Checked In Today' : 'Check In'}
          </button>
        }
      >
        <div className="cal-toolbar">
          <button className="btn btn-ghost btn-sm" onClick={() => setViewMonth(({year, month}) => {
            const m = month - 1;
            if (m < 0) return { year: year - 1, month: 11 };
            return { year, month: m };
          })}>◀</button>
          <div className="cal-title">{MONTHS[viewMonth.month]} {viewMonth.year}</div>
          <button className="btn btn-ghost btn-sm" onClick={() => setViewMonth(({year, month}) => {
            const m = month + 1;
            if (m > 11) return { year: year + 1, month: 0 };
            return { year, month: m };
          })}>▶</button>
        </div>
        <div className="check-calendar">
          {WEEKDAYS.map(d => <div key={d} className="cal-head">{d}</div>)}
          {grid.map((iso, i) => {
            if (!iso) return <div key={`empty-${i}`} className="cal-cell empty"></div>;
            const rec = historyByDate.get(iso);
            const day = Number(iso.slice(8, 10));
            const isToday = iso === todayISO();
            return (
              <button
                key={iso}
                type="button"
                className={`cal-cell${rec ? ' checked' : ''}${isToday ? ' today' : ''}`}
                onClick={() => rec && setSelectedDay(iso)}
                style={{ cursor: rec ? 'pointer' : 'default' }}
              >
                <span className="cal-day">{day}</span>
                {rec && <span className="cal-dot" aria-hidden="true"></span>}
              </button>
            );
          })}
        </div>
        <div className="cal-legend">
          <span className="cal-legend-dot" aria-hidden="true"></span>
          <span>Checked in</span>
          {selectedDay && historyByDate.get(selectedDay) && (
            <span style={{marginLeft:'auto', color:'var(--steel)'}}>
              {selectedDay} · checked in at {historyByDate.get(selectedDay).time}
              <button className="btn btn-ghost btn-sm" style={{marginLeft:8}} onClick={() => setSelectedDay(null)}>close</button>
            </span>
          )}
        </div>
      </TabbedCard>

      <div style={{height:18}}></div>

      <div className="grid grid-2">
        <TabbedCard label="Activity" title="Weekly Check-ins">
          <BarChart data={weeklyData} valueKey="v" labelKey="d" />
        </TabbedCard>
        <TabbedCard label="Coaching" title="Coaching Session Log">
          {mySessions.length === 0 ? (
            <div style={{fontSize:13, color:'var(--steel)', padding:'10px 0'}}>
              No coaching sessions yet. Book one from the Sessions tab.
            </div>
          ) : (
            <Table columns={['ID','Date','Trainer','Status']} rows={mySessions} renderRow={s => (
              <tr key={s.id}>
                <td className="mono">{s.id}</td>
                <td className="mono">{s.date}</td>
                <td>{s.trainer}</td>
                <td><Badge status={s.status}/></td>
              </tr>
            )} />
          )}
        </TabbedCard>
      </div>
    </>
  );
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default MemberActivity;
