import { Fragment } from 'react';

export function StepTrack({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="step-track">
      {steps.map((s, i) => (
        <Fragment key={s}>
          <div className={"step" + (i < current ? ' done' : '') + (i === current ? ' current' : '')}>
            <span className="dot">{i < current ? '✓' : i + 1}</span>{s}
          </div>
          {i < steps.length - 1 && <div className="sep"></div>}
        </Fragment>
      ))}
    </div>
  );
}
