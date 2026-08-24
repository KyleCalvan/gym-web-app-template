import type { ReactNode } from 'react';

export interface TabbedCardProps {
  label?: string;
  title?: string;
  right?: ReactNode;
  children?: ReactNode;
}

export function TabbedCard({ label, title, right, children }: TabbedCardProps) {
  return (
    <div className="card tabbed">
      {label && <span className="tab-label">{label}</span>}
      {title && (
        <div className="card-head">
          <h2>{title}</h2>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}
