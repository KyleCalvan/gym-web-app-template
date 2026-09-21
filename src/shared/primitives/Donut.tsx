import { motion } from 'framer-motion';
import { dur, ease, stagger, Ticker } from '../../motion.tsx';

export interface DonutProps {
  data: { l: string; v: number; color: string }[];
  size?: number;
}

export function Donut({ data, size = 140 }: DonutProps) {
  const total = data.reduce((a, d) => a + d.v, 0);
  let acc = 0;
  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`translate(${size / 2},${size / 2}) rotate(-90)`}>
          <circle r={r} fill="none" stroke="var(--steel-soft)" strokeWidth="16" />
          {data.map((d, i) => {
            const frac = d.v / total;
            const dash = frac * c;
            // Each segment starts with the dash "hidden" (offset pushes it past the
            // visible circumference) and animates dashoffset to its final position
            // so the segment sweeps in clockwise.
            const finalOffset = -acc;
            const startOffset = -(acc + dash);
            return (
              <motion.circle
                key={i}
                r={r}
                fill="none"
                stroke={d.color}
                strokeWidth="16"
                strokeDasharray={`${dash} ${c - dash}`}
                initial={{ strokeDashoffset: startOffset }}
                animate={{ strokeDashoffset: finalOffset }}
                transition={{ duration: dur.donut, delay: i * stagger.chart, ease: ease.out }}
              />
            );
          })}
        </g>
        <Ticker to={total} asText />
        <text x="50%" y="60%" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9" fill="var(--steel)">TOTAL</text>
      </svg>
      <div>
        {data.map((d, i) => (
          <div className="legend-item" key={i}>
            <span className="legend-dot" style={{ background: d.color }}></span>
            <span>{d.l}</span>
            <span className="mono" style={{ marginLeft: 6, color: 'var(--steel)' }}>{d.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
