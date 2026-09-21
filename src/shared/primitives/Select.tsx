import type { ReactNode, SelectHTMLAttributes } from 'react';

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'> {
  value: string;
  onChange: (v: string) => void;
  children?: ReactNode;
}

export function Select({ value, onChange, children, ...rest }: SelectProps) {
  return (
    <select
      className="form-control"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...rest}
    >
      {children}
    </select>
  );
}
