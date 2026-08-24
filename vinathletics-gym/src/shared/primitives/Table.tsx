import type { ReactNode } from 'react';

export interface TableProps<T> {
  columns: string[];
  rows: T[];
  renderRow: (row: T, index: number) => ReactNode;
}

export function Table<T>({ columns, rows, renderRow }: TableProps<T>) {
  return (
    <div className="table-wrap">
      <table className="tbl">
        <thead><tr>{columns.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length}><div className="empty-state"><div className="ic">🗂️</div>No records found.</div></td></tr>
          ) : rows.map((r, i) => renderRow(r, i))}
        </tbody>
      </table>
    </div>
  );
}
