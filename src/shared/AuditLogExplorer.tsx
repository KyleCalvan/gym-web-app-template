import { useEffect, useMemo, useRef, useState } from 'react';
import type { AuditLogEntry, Role } from '../types.ts';

const PAGE_SIZE = 25;
const SENSITIVE_KEY = /password|secret|token|credential|authorization|cookie|email|phone|address|birth|ssn|payment.?details/i;
const ROLES: Role[] = ['superadmin', 'admin', 'staff', 'trainer', 'member'];
const ROLE_LABELS: Record<Role, string> = {
  superadmin: 'Super Admin',
  admin: 'Admin',
  staff: 'Staff',
  trainer: 'Trainer',
  member: 'Member',
};

type SafeValue = string | number | boolean | null | SafeValue[] | { [key: string]: SafeValue };

function safeValue(value: unknown, key = ''): SafeValue {
  if (SENSITIVE_KEY.test(key)) return '[REDACTED]';
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    if (typeof value === 'string') {
      return value
        .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED EMAIL]')
        .replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, '[REDACTED PHONE]')
        .replace(/\b(?:Bearer\s+)?(?:sk|pk|api|key|token)[-_][A-Za-z0-9_-]{12,}\b/gi, '[REDACTED SECRET]');
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => safeValue(item));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([childKey]) => !SENSITIVE_KEY.test(childKey))
        .map(([childKey, childValue]) => [childKey, safeValue(childValue, childKey)]),
    );
  }
  return String(value);
}

function safeText(value: string | undefined): string {
  return typeof safeValue(value || '—') === 'string' ? safeValue(value || '—') as string : '—';
}

function categoryFor(entry: AuditLogEntry): string {
  if (entry.category) return entry.category;
  const action = entry.action.toLowerCase();
  if (/login|logout|session|auth|role/.test(action)) return 'Access';
  if (/plan|membership|promotion|member/.test(action)) return 'Members & Plans';
  if (/payment|receipt|invoice|refund|transaction|backup/.test(action)) return 'Finance & Backups';
  return 'Operations';
}

function formattedDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Invalid timestamp'
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' });
}

function DetailValue({ value }: { value: unknown }) {
  const safe = safeValue(value);
  return <pre className="audit-log-value">{JSON.stringify(safe, null, 2)}</pre>;
}

export default function AuditLogExplorer({
  auditLog,
  title,
  label,
}: {
  auditLog: AuditLogEntry[];
  title: string;
  label: string;
}) {
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [category, setCategory] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const entries = useMemo(() => {
    const unique = new Map<string, AuditLogEntry>();
    for (const entry of auditLog) {
      if (!unique.has(entry.id)) unique.set(entry.id, entry);
    }
    return [...unique.values()].sort((a, b) => {
      const left = Date.parse(a.at);
      const right = Date.parse(b.at);
      return (Number.isNaN(right) ? 0 : right) - (Number.isNaN(left) ? 0 : left);
    });
  }, [auditLog]);

  const categories = useMemo(
    () => ['All', ...new Set(entries.map(categoryFor))],
    [entries],
  );
  const actions = useMemo(
    () => [...new Set(entries.map((entry) => entry.action))].sort((a, b) => a.localeCompare(b)),
    [entries],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter((entry) => {
      const day = entry.at.slice(0, 10);
      const safeSearch = [
        entry.actorRole,
        safeText(entry.actor),
        entry.action,
        safeText(entry.details),
        safeText(entry.resource),
        safeText(entry.result),
      ].join(' ').toLowerCase();
      return (roleFilter === 'all' || entry.actorRole === roleFilter)
        && (actionFilter === 'all' || entry.action === actionFilter)
        && (category === 'All' || categoryFor(entry) === category)
        && (!fromDate || day >= fromDate)
        && (!toDate || day <= toDate)
        && (!needle || safeSearch.includes(needle));
    });
  }, [entries, query, roleFilter, actionFilter, category, fromDate, toDate]);

  const visible = filtered.slice(0, visibleCount);
  const selected = visible.find((entry) => entry.id === selectedId) || visible[0] || null;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setSelectedId(null);
  }, [query, roleFilter, actionFilter, category, fromDate, toDate]);

  useEffect(() => {
    const root = listRef.current;
    const target = sentinelRef.current;
    if (!root || !target || visibleCount >= filtered.length) return;
    try {
      const observer = new IntersectionObserver((observations) => {
        if (!observations.some((observation) => observation.isIntersecting)) return;
        observer.disconnect();
        setLoadingMore(true);
        window.setTimeout(() => {
          setVisibleCount((count) => Math.min(count + PAGE_SIZE, filtered.length));
          setLoadingMore(false);
        }, 120);
      }, { root, rootMargin: '160px' });
      observer.observe(target);
      return () => observer.disconnect();
    } catch (error) {
      console.error('Could not observe the audit log list for infinite loading.', error);
      setLoadError('Automatic loading is unavailable. Use the button to load more entries.');
    }
  }, [visibleCount, filtered.length]);

  const counts = {
    info: entries.filter((entry) => entry.level === 'info').length,
    warn: entries.filter((entry) => entry.level === 'warn').length,
    error: entries.filter((entry) => entry.level === 'error').length,
  };

  return (
    <section className="audit-log-explorer" aria-label={title}>
      <div className="grid grid-4 audit-log-stats">
        <div className="stat-tile"><div className="eyebrow">Total Entries</div><div className="num">{entries.length}</div></div>
        <div className="stat-tile"><div className="eyebrow">Info</div><div className="num">{counts.info}</div></div>
        <div className="stat-tile"><div className="eyebrow">Warning</div><div className="num">{counts.warn}</div></div>
        <div className="stat-tile"><div className="eyebrow">Errors</div><div className="num">{counts.error}</div></div>
      </div>

      <section className="card tabbed">
        <span className="tab-label">{label}</span>
        <div className="card-head"><h2>{title}</h2></div>

        <div className="audit-log-categories" role="tablist" aria-label="Log categories">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={category === item}
              className={`audit-log-category${category === item ? ' is-active' : ''}`}
              onClick={() => setCategory(item)}
            >
              <span aria-hidden="true">▰</span>{item}
            </button>
          ))}
        </div>

        <div className="audit-log-filters">
          <input aria-label="Search logs" type="search" placeholder="Search logs…" value={query} onChange={(event) => setQuery(event.target.value)} />
          <select aria-label="Filter by action" value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
            <option value="all">All actions</option>
            {actions.map((action) => <option value={action} key={action}>{action}</option>)}
          </select>
          <select aria-label="Filter by role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="all">All roles</option>
            {ROLES.map((role) => <option value={role} key={role}>{ROLE_LABELS[role]}</option>)}
          </select>
          <label>From <input aria-label="Filter from date" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
          <label>To <input aria-label="Filter to date" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
        </div>

        {entries.length === 0 ? (
          <div className="audit-log-empty">No audit entries have been recorded yet.</div>
        ) : filtered.length === 0 ? (
          <div className="audit-log-empty">No entries match these filters.</div>
        ) : (
          <div className="audit-log-layout">
            <div className="audit-log-list" aria-label="Audit entries" ref={listRef} tabIndex={0}>
              {visible.map((entry) => (
                <button
                  type="button"
                  key={entry.id}
                  className={`audit-log-row${selected?.id === entry.id ? ' is-selected' : ''}`}
                  aria-pressed={selected?.id === entry.id}
                  onClick={() => setSelectedId(entry.id)}
                >
                  <span className={`audit-log-level level-${entry.level}`}>{entry.level}</span>
                  <span className="audit-log-row-copy">
                    <strong>{safeText(entry.action)}</strong>
                    <span>{safeText(entry.actor)} · {ROLE_LABELS[entry.actorRole]}</span>
                    <time dateTime={entry.at}>{formattedDate(entry.at)}</time>
                  </span>
                </button>
              ))}
              {visibleCount < filtered.length && (
                <>
                  <div ref={sentinelRef} className="audit-log-sentinel" aria-live="polite">
                    {loadingMore ? 'Loading more entries…' : loadError || 'Scroll for more entries'}
                  </div>
                  {loadError && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        setLoadError(null);
                        setVisibleCount((count) => Math.min(count + PAGE_SIZE, filtered.length));
                      }}
                    >
                      Load more
                    </button>
                  )}
                </>
              )}
              {visibleCount >= filtered.length && <p className="audit-log-end">Showing all {filtered.length} matching entries</p>}
            </div>

            {selected && (
              <aside className="audit-log-detail" aria-label="Selected log details">
                <div className="audit-log-detail-heading">
                  <div>
                    <span className={`audit-log-level level-${selected.level}`}>{selected.level}</span>
                    <h3>{safeText(selected.action)}</h3>
                  </div>
                  <span className="audit-log-category-tag">{categoryFor(selected)}</span>
                </div>
                <dl className="audit-log-fields">
                  <div><dt>Timestamp</dt><dd>{formattedDate(selected.at)}</dd></div>
                  <div><dt>Actor</dt><dd>{safeText(selected.actor)}</dd></div>
                  <div><dt>Role</dt><dd>{ROLE_LABELS[selected.actorRole]}</dd></div>
                  <div><dt>Affected resource</dt><dd>{safeText(selected.resource)}</dd></div>
                  <div><dt>Result</dt><dd>{safeText(selected.result)}</dd></div>
                  {selected.ipAddress && <div><dt>IP address</dt><dd>{safeText(selected.ipAddress)}</dd></div>}
                  <div><dt>Details</dt><dd>{safeText(selected.details)}</dd></div>
                </dl>
                {selected.metadata && Object.keys(safeValue(selected.metadata) as object).length > 0 && (
                  <div className="audit-log-structured"><h4>Context</h4><DetailValue value={selected.metadata} /></div>
                )}
                {selected.before !== undefined && (
                  <div className="audit-log-structured"><h4>Before</h4><DetailValue value={selected.before} /></div>
                )}
                {selected.after !== undefined && (
                  <div className="audit-log-structured"><h4>After</h4><DetailValue value={selected.after} /></div>
                )}
              </aside>
            )}
          </div>
        )}
      </section>
    </section>
  );
}
