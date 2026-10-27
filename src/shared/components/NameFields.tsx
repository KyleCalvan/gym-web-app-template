import { useId } from 'react';
import type { NameParts } from '../nameParts';
export function NameFields({ value, onChange, prefix, errors = {}, disabled = false }: {
  value: NameParts; onChange: (value: NameParts) => void; prefix?: string; errors?: Record<string, string>; disabled?: boolean;
}) {
  const generated = useId();
  const idPrefix = prefix || generated;
  const fields = [
    { key: 'firstName', label: 'First Name', required: true, autocomplete: 'given-name' },
    { key: 'middleName', label: 'Middle Name (optional)', required: false, autocomplete: 'additional-name' },
    { key: 'lastName', label: 'Last Name', required: true, autocomplete: 'family-name' },
    { key: 'suffix', label: 'Suffix (optional)', required: false, autocomplete: 'honorific-suffix' },
  ] as const;
  return <div className="person-name-grid">{fields.map(field => {
    const id = idPrefix + '-' + field.key;
    const error = errors[id];
    return <div className="form-group" key={field.key}>
      <label htmlFor={id}>{field.label}</label>
      <input id={id} name={field.key} className="form-control" autoComplete={field.autocomplete}
        required={field.required} maxLength={field.key === 'suffix' ? 16 : 60} disabled={disabled}
        value={value[field.key] || ''} onChange={event => onChange({ ...value, [field.key]: event.target.value })}
        aria-invalid={Boolean(error)} aria-describedby={error ? id + '-error' : undefined} />
      {error && <p id={id + '-error'} className="field-error" role="alert">{error}</p>}
    </div>;
  })}</div>;
}
