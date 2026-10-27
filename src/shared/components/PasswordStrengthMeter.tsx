import React from 'react';

interface PasswordStrengthMeterProps {
  password: string;
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const getStrength = (p: string) => {
    if (!p) return 0;
    if (p.length < 8) return 1;
    if (p.length < 12 || !(/[A-Z]/.test(p) && /[0-9]/.test(p))) return 2;
    return 3;
  };

  const strength = getStrength(password);
  const colors = ['var(--line)', 'var(--danger)', 'var(--amber)', 'var(--signal)'];

  return (
    <div style={{ position: 'relative', marginBottom: 20 }}>
      <div style={{
        display: 'flex',
        gap: '4px',
        marginTop: '6px',
        height: '4px'
      }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            flex: 1,
            backgroundColor: i <= strength ? colors[strength] : 'var(--line)',
            borderRadius: '2px',
            transition: 'background-color 0.2s ease'
          }} />
        ))}
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '8px',
        fontSize: '11px',
        fontFamily: 'var(--font-mono)',
        color: 'var(--steel)',
        pointerEvents: 'none'
      }}>
        <span style={{ color: strength === 1 ? 'var(--danger)' : 'inherit' }}>Weak</span>
        <span style={{ color: strength === 2 ? 'var(--amber)' : 'inherit' }}>Good</span>
        <span style={{ color: strength === 3 ? 'var(--signal-ink)' : 'inherit' }}>Strong</span>
      </div>
    </div>
  );
}
