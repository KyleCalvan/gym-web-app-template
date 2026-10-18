import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

const ROW_BATCH_SIZE = 30;

export interface TableProps<T> {
  columns: string[];
  rows: T[];
  renderRow: (row: T, index: number) => ReactNode;
}

export function Table<T>({ columns, rows, renderRow }: TableProps<T>) {
  const [visibleCount, setVisibleCount] = useState(ROW_BATCH_SIZE);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLTableRowElement>(null);
  const rowSignature = useMemo(() => rows.map((row) => {
    if (row && typeof row === 'object' && 'id' in row) return String(row.id);
    try {
      return JSON.stringify(row);
    } catch {
      return String(row);
    }
  }).join('\u001f'), [rows]);
  const visibleRows = rows.slice(0, visibleCount);

  useEffect(() => {
    setVisibleCount(ROW_BATCH_SIZE);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [rowSignature]);

  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || visibleCount >= rows.length) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      setVisibleCount((count) => Math.min(count + ROW_BATCH_SIZE, rows.length));
    }, { root, rootMargin: '120px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, rows.length]);

  return (
    <div className="table-wrap" ref={scrollRef} role="region" aria-label="Scrollable table" tabIndex={0}>
      <table className="tbl">
        <thead><tr>{columns.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
        <tbody>
          {visibleRows.length === 0 ? (
            <tr><td colSpan={columns.length}><div className="empty-state"><div className="ic"></div>No records found.</div></td></tr>
          ) : visibleRows.map((r, i) => renderRow(r, i))}
          {visibleCount < rows.length && (
            <tr ref={sentinelRef} aria-hidden="true">
              <td colSpan={columns.length} className="table-load-more">Loading more rows…</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
