// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatTime12h } from '../trainer/availability';
import { gymDateISO } from './activityDates';
import { Badge, BarChart, StatTile, TabbedCard, Table, Modal, Field } from '../shared';

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
  members, setMembers, sessions, currentUserId,
  checkInHistory, setCheckInHistory, setCheckIns, toast, emptyDefaults = false,
}) {
  const me = members.find(m => m.id === currentUserId) || members[0];
  const myId = me?.id || '';
  const [activity, setActivity] = useState(null);
  const [activityError, setActivityError] = useState('');
  const [saving, setSaving] = useState(false);
  const live = emptyDefaults;
  const today = live ? gymDateISO() : todayISO();
  const history = live ? (activity?.checkInHistory ?? []) : checkInHistory;
  const allSessions = live ? (activity?.sessions ?? []) : sessions;
  const canCheckIn = live ? activity?.canCheckIn === true : me?.status !== 'Frozen';

  const loadActivity = () => {
    setActivityError('');
    fetch('/api/member/activity', { cache: 'no-store' })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Activity could not be loaded.');
        setActivity(data);
      })
      .catch(error => setActivityError(error instanceof Error ? error.message : 'Activity could not be loaded.'));
  };
  useEffect(() => { if (live) loadActivity(); }, [live]);

  const checkedToday = useMemo(
    () => history.some(r => r.memberId === myId && r.date === today),
    [history, myId, today],
  );
  const isFrozen = live ? activity?.membershipStatus === 'Frozen' : me?.status === 'Frozen';
  const [metrics, setMetrics] = useState(() => ({ weightKg: me?.weightKg ?? (emptyDefaults ? 0 : 72), heightCm: me?.heightCm ?? (emptyDefaults ? 0 : 172) }));
  useEffect(() => {
    if (live && activity) setMetrics({ weightKg: activity.weightKg ?? 0, heightCm: activity.heightCm ?? 0 });
  }, [live, activity?.weightKg, activity?.heightCm]);
  const [editingMetrics, setEditingMetrics] = useState(false);
  const [metricDraft, setMetricDraft] = useState(metrics);
  const heightM = metrics.heightCm / 100;
  const hasMetrics = metrics.weightKg > 0 && metrics.heightCm > 0;
  const bmi = heightM > 0 ? metrics.weightKg / (heightM * heightM) : 0;
  const bmiCategory = bmi < 18.5 ? { label: 'Underweight', tone: 'warn' }
    : bmi < 25 ? { label: 'Healthy', tone: 'ok' }
    : bmi < 30 ? { label: 'Overweight', tone: 'warn' }
    : { label: 'Obese', tone: 'warn' };
  const mySessionsCount = allSessions.filter(s => s.member === (live ? myId : me?.name)).length;
  const sessionPct = Math.min(100, Math.round((mySessionsCount / 10) * 100));

  const saveMetrics = async (e) => {
    e.preventDefault();
    const weightKg = Number(metricDraft.weightKg);
    const heightCm = Number(metricDraft.heightCm);
    if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm) || weightKg < 20 || weightKg > 500 || heightCm < 50 || heightCm > 300) {
      toast('Please enter realistic values');
      return;
    }
    if (live) {
      setSaving(true);
      try {
        const response = await fetch('/api/member/activity', { method: 'PATCH',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ weightKg, heightCm }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Metrics could not be saved.');
        setActivity(previous => ({ ...previous, weightKg: data.weightKg, heightCm: data.heightCm }));
        setMetrics({ weightKg: data.weightKg, heightCm: data.heightCm });
        setEditingMetrics(false);
        toast('Progress metrics saved');
      } catch (error) {
        toast(error instanceof Error ? error.message : 'Metrics could not be saved.');
      } finally { setSaving(false); }
      return;
    }
    setMembers((previous) => previous.map((member) => member.id === me?.id ? { ...member, weightKg, heightCm } : member));
    setMetrics({ weightKg, heightCm });
    setEditingMetrics(false);
    toast('Progress metrics saved');
  };

  const myHistory = useMemo(
    () => history.filter(r => r.memberId === myId),
    [history, myId],
  );
  const historyByDate = useMemo(() => {
    const m = new Map();
    myHistory.forEach(r => m.set(r.date, r));
    return m;
  }, [myHistory]);

  // Reuse the member's existing sessions; never expose another member's entries.
  const sessionsByDate = useMemo(() => {
    const days = new Map();
    allSessions.filter(session => session.member === (live ? myId : me?.name)).forEach(session => {
      const day = session.date.slice(0, 10);
      days.set(day, [...(days.get(day) || []), session]);
    });
    return days;
  }, [allSessions, live, myId, me?.name]);

  // Calendar view state
  const [viewMonth, setViewMonth] = useState(() => {
    const current = live ? gymDateISO() : todayISO();
    return { year: Number(current.slice(0, 4)), month: Number(current.slice(5, 7)) - 1 };
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
    const cursor = new Date(`${today}T12:00:00.000Z`);
    // Allow streak if today OR yesterday is in dates.
    if (!dates.has(cursor.toISOString().slice(0, 10))) {
      cursor.setUTCDate(cursor.getUTCDate() - 1);
      if (!dates.has(cursor.toISOString().slice(0, 10))) return 0;
    }
    while (dates.has(cursor.toISOString().slice(0, 10))) {
      count++;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    return count;
  }, [myHistory, today]);

  // Monthly check-in count (real data).
  const monthCheckIns = useMemo(() => {
    const ym = today.slice(0, 7);
    return myHistory.filter(r => r.date.startsWith(ym)).length;
  }, [myHistory, today]);
  const monthCheckPct = Math.min(100, Math.round((monthCheckIns / 20) * 100));

  // Four seven-day windows ending on the gym's current date.
  const weeklyData = useMemo(() => {
    const now = Date.parse(`${today}T00:00:00.000Z`);
    const buckets = [0, 0, 0, 0]; // Wk1..Wk4
    myHistory.forEach(r => {
      const diffDays = Math.round((now - Date.parse(`${r.date}T00:00:00.000Z`)) / (1000 * 60 * 60 * 24));
      if (diffDays < 0 || diffDays >= 28) return;
      const idx = Math.floor(diffDays / 7);
      buckets[idx]++;
    });
    return [
      { d: '21–27d ago', v: buckets[3] },
      { d: '14–20d ago', v: buckets[2] },
      { d: '7–13d ago', v: buckets[1] },
      { d: 'Past 7d', v: buckets[0] },
    ];
  }, [myHistory, today]);

  // Coaching session log (filter sessions for me).
  const mySessions = useMemo(
    () => allSessions
      .filter(s => s.member === (live ? myId : me?.name))
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [allSessions, live, myId, me?.name],
  );

  const handleCheckIn = async () => {
    if (isFrozen) { toast('Frozen accounts cannot check in.', 'error'); return; }
    if (checkedToday) { toast('Already checked in today.', 'info'); return; }
    if (live) {
      if (!canCheckIn) { toast('An active membership is required to check in.', 'error'); return; }
      setSaving(true);
      try {
        const response = await fetch('/api/member/activity', { method: 'POST' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Check-in could not be saved.');
        setActivity(previous => ({ ...previous, checkInHistory: [...previous.checkInHistory, data.checkIn] }));
        setSelectedDay(data.checkIn.date);
        toast('Checked in — see you at the gym!', 'success');
      } catch (error) {
        toast(error instanceof Error ? error.message : 'Check-in could not be saved.');
        loadActivity();
      } finally { setSaving(false); }
      return;
    }
    const date = todayISO();
    const time = nowHHMM();
    setCheckInHistory(prev => [...prev, {
      id: `CKI-${myId}-${Date.now()}`,
      memberId: myId,
      date,
      time,
    }]);
    setCheckIns(c => ({ ...c, count: c.count + 1 }));
    toast('Checked in — see you at the gym!', 'success');
    setSelectedDay(date);
  };

  if (live && !activity) return <div className="member-activity" role="status">
    {activityError ? <p role="alert">{activityError} <button type="button" onClick={loadActivity}>Retry</button></p> : 'Loading your activity…'}
  </div>;

  return (
    <div className="member-activity">
      <div className="grid grid-4" style={{marginBottom:18}}>
        <StatTile label="Check-ins This Month" value={monthCheckIns} tone="court" />
        <StatTile label="Total Check-ins" value={myHistory.length} />
        <StatTile label="Current Streak" value={`${streak} day${streak === 1 ? '' : 's'}`} tone="amber" />
        <StatTile label="Coaching Sessions" value={mySessions.length} tone="steel" />
      </div>

      <TabbedCard
        right={<button className="btn btn-outline btn-sm" onClick={()=>{setMetricDraft(metrics); setEditingMetrics(true);}}>Update Metrics</button>}
        title={live ? 'Body Metrics' : 'Body Metrics & Goals'}
      >
        <div className="metrics-tracker">
          <div className="metric-tile">
            <div className="lbl">Weight</div>
            <div className="val">{metrics.weightKg > 0 ? metrics.weightKg.toFixed(1) : '—'}{metrics.weightKg > 0 && <span className="metric-unit">kg</span>}</div>
            <div className="sub">{metrics.weightKg > 0 ? 'Saved profile metric' : 'Not recorded'}</div>
          </div>
          <div className="metric-tile">
            <div className="lbl">Height</div>
            <div className="val">{metrics.heightCm > 0 ? metrics.heightCm.toFixed(0) : '—'}{metrics.heightCm > 0 && <span className="metric-unit">cm</span>}</div>
            <div className="sub">{metrics.heightCm > 0 ? `${(metrics.heightCm / 100).toFixed(2)} m` : 'Not recorded'}</div>
          </div>
          <div className={`metric-tile ${bmiCategory.tone}`}>
            <div className="lbl">BMI</div>
            <div className="val">{hasMetrics ? bmi.toFixed(1) : '—'}</div>
            <div className="sub">{hasMetrics ? bmiCategory.label : 'Not recorded'}</div>
          </div>
        </div>
        {!live && <div className="member-progress-goals">
          <div>
            <div className="member-progress-label"><span>Monthly check-in goal</span><span className="mono">{monthCheckIns}/20 · {monthCheckPct}%</span></div>
            <div className="progress-bar"><div style={{width:`${monthCheckPct}%`}}></div></div>
          </div>
          <div>
            <div className="member-progress-label"><span>Coaching session target</span><span className="mono">{mySessionsCount}/10 · {sessionPct}%</span></div>
            <div className="progress-bar"><div style={{width:`${sessionPct}%`}}></div></div>
          </div>
        </div>}
      </TabbedCard>

      {isFrozen && (
        <TabbedCard title="">
          <div style={{display:'flex', alignItems:'center', gap:12}}>
            <Badge status="Frozen" />
            <div style={{fontSize:14.3, color:'var(--steel)'}}>
              Your account is currently frozen. Check-in is paused. Contact admin to unfreeze.
            </div>
          </div>
        </TabbedCard>
      )}


      <TabbedCard
        title="Check-in Calendar"
        right={
          <button
            className="btn btn-signal btn-sm"
            onClick={handleCheckIn}
            disabled={!canCheckIn || checkedToday || saving}
            title={isFrozen ? 'Frozen accounts cannot check in' : !canCheckIn ? 'An active membership is required' : (checkedToday ? 'Already checked in today' : 'Tap to record today\'s visit')}
          >
            {checkedToday ? 'Checked In Today' : 'Check In'}
          </button>
        }
      >
        {live && !canCheckIn && !isFrozen && !checkedToday &&
          <p className="member-metric-help">An active membership is required to check in.</p>}
        <div className="cal-toolbar" aria-label="Calendar month navigation">
          <button aria-label="Previous month" className="btn btn-ghost btn-sm" onClick={() => setViewMonth(({year, month}) => {
            const m = month - 1;
            if (m < 0) return { year: year - 1, month: 11 };
            return { year, month: m };
          })}><ChevronLeft size={18} /></button>
          <div className="cal-title" aria-live="polite">{MONTHS[viewMonth.month]} {viewMonth.year}</div>
          <button aria-label="Next month" className="btn btn-ghost btn-sm" onClick={() => setViewMonth(({year, month}) => {
            const m = month + 1;
            if (m > 11) return { year: year + 1, month: 0 };
            return { year, month: m };
          })}><ChevronRight size={18} /></button>
        </div>
        <div className="check-calendar">
          {WEEKDAYS.map(d => <div key={d} className="cal-head">{d}</div>)}
          {grid.map((iso, i) => {
            if (!iso) return <div key={`empty-${i}`} className="cal-cell empty"></div>;
            const rec = historyByDate.get(iso);
            const entries = sessionsByDate.get(iso) || [];
            const day = Number(iso.slice(8, 10));
            const isToday = iso === today;
            return (
              <button
                key={iso}
                type="button"
                className={`cal-cell${rec ? ' checked' : ''}${isToday ? ' today' : ''}${selectedDay === iso ? ' selected' : ''}`}
                onClick={() => setSelectedDay(iso)}
                aria-pressed={selectedDay === iso}
                aria-current={isToday ? 'date' : undefined}
                aria-label={`${iso}${rec ? ', checked in' : ''}, ${entries.length} scheduled sessions`}
              >
                <span className="cal-day">{day}</span>
                {rec && <span className="cal-dot" aria-hidden="true" />}
                {entries.length > 0 && <span className="cal-session-count">{entries.length}<span className="cal-session-label"> session{entries.length === 1 ? '' : 's'}</span></span>}
              </button>
            );
          })}
        </div>
        <div className="cal-legend">
          <span className="cal-legend-dot" aria-hidden="true"></span>
          <span>Checked in</span>
          <span className="cal-session-indicator" aria-hidden="true" /> <span>Coaching session</span>
        </div>
        {selectedDay && <section className="trainer-selected-day" aria-label="Selected day's activities">
          <div className="trainer-selected-day-heading member-day-heading">
            <div><span>Daily activity</span><h3>{new Date(selectedDay + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h3></div>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedDay(null)}>Close</button>
          </div>
          <div className="member-activity-list">
            {historyByDate.get(selectedDay) && <div className="member-activity-record">
              <span className="trainer-detail-time">{formatTime12h(historyByDate.get(selectedDay).time)}</span>
              <span><strong>Gym check-in</strong><small>Your recorded visit</small></span><Badge status="Completed" />
            </div>}
            {(sessionsByDate.get(selectedDay) || []).map(session => <div className="member-activity-record" key={session.id}>
              <span className="trainer-detail-time">{session.time}</span>
              <span><strong>{session.type}</strong><small>With {session.trainer}</small></span><Badge status={session.status} />
            </div>)}
            {!historyByDate.has(selectedDay) && !sessionsByDate.has(selectedDay) && <p className="trainer-calendar-empty">No check-ins or coaching sessions on this date.</p>}
          </div>
        </section>}
      </TabbedCard>

      <div style={{height:18}}></div>

      <div className="grid grid-2">
        <TabbedCard title="Check-ins Over the Past 28 Days">
          <BarChart data={weeklyData} valueKey="v" labelKey="d" />
        </TabbedCard>
        <TabbedCard title="Coaching Session Log">
          {mySessions.length === 0 ? (
            <div style={{fontSize:14.3, color:'var(--steel)', padding:'10px 0'}}>
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
      {editingMetrics && (
        <Modal title="Update Body Metrics" onClose={()=>setEditingMetrics(false)}>
          <form onSubmit={saveMetrics}>
            <div className="grid grid-2">
              <Field label="Weight (kg)">
                <input className="form-control" type="number" min="20" step="0.1" required
                  value={metricDraft.weightKg} onChange={e=>setMetricDraft(d=>({...d, weightKg:e.target.value}))} />
              </Field>
              <Field label="Height (cm)">
                <input className="form-control" type="number" min="50" step="0.5" required
                  value={metricDraft.heightCm} onChange={e=>setMetricDraft(d=>({...d, heightCm:e.target.value}))} />
              </Field>
            </div>
            <p className="member-metric-help">BMI is calculated automatically from weight and height.</p>
            <button type="submit" className="btn btn-signal btn-block" disabled={saving}>Save Metrics</button>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default MemberActivity;
