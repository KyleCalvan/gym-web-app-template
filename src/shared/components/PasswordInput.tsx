import { useState } from 'react';
import { TextInput } from '../primitives/TextInput';

interface PasswordInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}

export function PasswordInput({ label, value, onChange, placeholder, required }: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        display: 'block',
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        color: 'var(--steel)',
        marginBottom: '6px'
      }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <TextInput
          type={isVisible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
        />
        <button
          type="button"
          onClick={() => setIsVisible(!isVisible)}
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            color: 'var(--steel)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            fontSize: '16px',
            padding: 0,
            zIndex: 2
          }}
        >
          {isVisible ? '👁️' : '🙈'}
        </button>
      </div>
    </div>
  );
}
