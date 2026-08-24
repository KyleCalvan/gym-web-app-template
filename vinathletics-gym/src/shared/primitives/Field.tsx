import type { ReactNode } from 'react';

export interface FieldProps {
  label?: string;
  children?: ReactNode;
}

export function Field({ label, children }: FieldProps) {
  return (
    <div className="form-group">
      {label && <label>{label}</label>}
      {children}
    </div>
  );
}
