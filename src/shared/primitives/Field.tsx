import type { ReactNode } from 'react';

export interface FieldProps {
  label?: string;
  htmlFor?: string;
  children?: ReactNode;
}

export function Field({ label, htmlFor, children }: FieldProps) {
  return (
    <div className="form-group">
      {label && <label htmlFor={htmlFor}>{label}</label>}
      {children}
    </div>
  );
}
