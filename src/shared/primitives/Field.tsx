import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { TextInput } from './TextInput';
import { Select } from './Select';
export interface FieldProps { label?: string; htmlFor?: string; children?: ReactNode; }
export function Field({ label, htmlFor, children }: FieldProps) {
  const generated = useId();
  const canLabel = isValidElement(children) && (['input','textarea','select'].includes(String(children.type)) || children.type === TextInput || children.type === Select);
  const input = canLabel ? children as ReactElement<{id?: string}> : null;
  const id = htmlFor || input?.props.id || generated;
  return <div className="form-group">
    {label && <label htmlFor={input || htmlFor ? id : undefined}>{label}</label>}
    {input ? cloneElement(input,{id}) : children}
  </div>;
}
