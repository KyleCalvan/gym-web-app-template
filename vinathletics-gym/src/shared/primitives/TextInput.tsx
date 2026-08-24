import type { InputHTMLAttributes } from 'react';

export interface TextInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: string;
  onChange: (v: string) => void;
  type?: InputHTMLAttributes<HTMLInputElement>['type'];
}

export function TextInput({ value, onChange, type = 'text', ...rest }: TextInputProps) {
  return (
    <input
      className="form-control"
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...rest}
    />
  );
}
