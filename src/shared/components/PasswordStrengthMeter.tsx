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
  const colors = ['#E0E0E0', '#FF4D4F', '#FAAD14', '#9BE92A']; // Grey, Red, Yellow, Lime

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
            backgroundColor: i <= strength ? colors[strength] : '#262626',
            borderRadius: '2px',
            transition: 'background-color 0.2s ease'
          }} />
        ))}
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '8px',
        fontSize: '10px',
        fontFamily: 'var(--font-mono)',
        color: 'var(--steel)',
        pointerEvents: 'none'
      }}>
        <span style={{ color: strength === 1 ? '#FF4D4F' : 'inherit' }}>Weak</span>
        <span style={{ color: strength === 2 ? '#FAAD14' : 'inherit' }}>Good</span>
        <span style={{ color: strength === 3 ? '#9BE92A' : 'inherit' }}>Strong</span>
      </div>
    </div>
  );
}
