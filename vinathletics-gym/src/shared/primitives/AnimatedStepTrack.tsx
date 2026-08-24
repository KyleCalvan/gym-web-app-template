import { Fragment } from 'react';
import { motion } from 'framer-motion';
import { dur, ease } from '../../motion.tsx';

export function AnimatedStepTrack({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="step-track">
      {steps.map((s, i) => (
        <Fragment key={s}>
          <motion.div
            className={"step" + (i < current ? ' done' : '') + (i === current ? ' current' : '')}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: dur.base, ease: ease.out }}
          >
            <span className="dot">{i < current ? '✓' : i + 1}</span>{s}
          </motion.div>
          {i < steps.length - 1 && (
            <div className="sep" style={{ position: 'relative', overflow: 'hidden' }}>
              <motion.div
                style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  background: 'var(--court)',
                  transformOrigin: 'left center',
                }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: i < current ? 1 : 0 }}
                transition={{ duration: 0.32, ease: ease.out, delay: 0.05 }}
              />
            </div>
          )}
        </Fragment>
      ))}
    </div>
  );
}
