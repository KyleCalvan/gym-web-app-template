import { motion } from 'framer-motion';
import { dur, ease } from '../../motion.tsx';

export interface BarChartProps<T extends Record<string, unknown>> {
  data: T[];
  valueKey: keyof T;
  labelKey: keyof T;
  prefix?: string;
}

export function BarChart<T extends Record<string, unknown>>({
  data, valueKey, labelKey, prefix,
}: BarChartProps<T>) {
  const max = Math.max(...data.map((d) => Number(d[valueKey])));
  return (
    <div className="bar-chart">
      {data.map((d, i) => {
        const v = Number(d[valueKey]);
        const targetPx = (v / max * 110) + 'px';
        return (
          <div className="col" key={i}>
            <div className="mono" style={{ fontSize: 10, color: 'var(--steel)' }}>
              {prefix || ''}{(v / 1000).toFixed(0)}k
            </div>
            <motion.div
              className={"bar" + (i === data.length - 1 ? " signal" : "")}
              initial={{ height: 0 }}
              animate={{ height: targetPx }}
              transition={{ duration: dur.bar, delay: i * 0.05, ease: ease.out }}
            />
            <div className="lab">{String(d[labelKey])}</div>
          </div>
        );
      })}
    </div>
  );
}
