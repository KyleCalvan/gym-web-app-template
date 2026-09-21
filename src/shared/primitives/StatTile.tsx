import { motion } from 'framer-motion';
import { dur, ease, stagger, Ticker } from '../../motion.tsx';

export type StatTileValue =
  | string
  | number
  | { to: number; prefix?: string; suffix?: string; format?: (n: number) => string | number };

export interface StatTileProps {
  label: string;
  value: StatTileValue;
  delta?: string;
  tone?: string;
  index?: number;
}

export function StatTile({ label, value, delta, tone, index = 0 }: StatTileProps) {
  // If `value` is an object, render a Ticker; otherwise plain text.
  const valueNode =
    value && typeof value === 'object' && 'to' in value ? (
      <Ticker
        to={value.to}
        prefix={value.prefix ?? ''}
        suffix={value.suffix ?? ''}
        format={value.format}
      />
    ) : (
      value
    );
  return (
    <motion.div
      className={"stat-tile" + (tone ? " " + tone : "")}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * stagger.tile, duration: dur.base, ease: ease.out }}
    >
      <div className="l">{label}</div>
      <div className="n mono">{valueNode}</div>
      {delta && (
        <motion.div
          className={"d" + (String(delta).startsWith('-') ? " down" : "")}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * stagger.tile + 0.08, duration: dur.base, ease: ease.out }}
        >
          {delta}
        </motion.div>
      )}
    </motion.div>
  );
}
