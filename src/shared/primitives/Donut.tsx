import { useEnterMotion } from '../hooks/useEnterMotion';
export interface DonutProps { data: { l: string; v: number; color: string }[]; size?: number; }
export function Donut({ data, size = 156 }: DonutProps) {
  const root = useEnterMotion<HTMLDivElement>(data.map(d => d.l + d.v).join('|'));
  const total = data.reduce((sum, d) => sum + d.v, 0);
  if (!total) return <p className="distribution-empty">No memberships recorded.</p>;
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return <div ref={root} className="donut-wrap" role="img" aria-label={data.map(d => d.l + ': ' + d.v).join(', ')}>
    <svg width={size} height={size} viewBox={'0 0 ' + size + ' ' + size} aria-hidden="true">
      <g transform={'translate(' + size / 2 + ',' + size / 2 + ') rotate(-90)'}>
        <circle r={radius} fill="none" stroke="var(--line)" strokeWidth="9" />
        {data.map(d => {
          const length = d.v / total * circumference;
          const start = -offset;
          offset += length;
          return <circle key={d.l} r={radius} fill="none" stroke={d.color} strokeWidth="9" strokeDasharray={length + ' ' + (circumference-length)} strokeDashoffset={start} />;
        })}
      </g>
      <text x="50%" y="48%" dominantBaseline="middle" textAnchor="middle" fill="var(--ink)" fontSize="28" fontWeight="600">{total}</text>
      <text x="50%" y="66%" textAnchor="middle" fill="var(--steel)" fontSize="12">Members</text>
    </svg>
    <div>{data.map(d => <div className="legend-item" key={d.l}><span className="legend-dot" style={{background:d.color}} /><span>{d.l}</span><span className="legend-value">{d.v} · {Math.round(d.v/total*100)}%</span></div>)}</div>
  </div>;
}
