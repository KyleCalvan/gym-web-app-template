import { useState } from 'react';
import { Modal } from '../primitives/Modal.tsx';
import { TextInput } from '../primitives/TextInput';
import { Field } from '../primitives/Field';
import { Badge } from '../primitives/Badge';
import { PasswordInput } from './PasswordInput';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';

interface SecurityFlowProps {
  isOpen: boolean;
  onClose: () => void;
  toast: (msg: string) => void;
}

export function SecurityFlow({ isOpen, onClose, toast }: SecurityFlowProps) {
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: '',
  });

  if (!isOpen) return null;

  const handleReset = () => {
    if (passwords.new !== passwords.confirm) {
      toast('Passwords do not match');
      return;
    }
    toast('Password changed successfully');
    setPasswords({ current: '', new: '', confirm: '' });
    onClose();
  };

  const handleForgot = () => {
    if (!email) {
      toast('Please enter your email');
      return;
    }
    toast('Reset link sent to ' + email);
    setStep(3);
  };

  return (
    <Modal title={step === 0 ? 'Security Settings' : step === 1 ? 'Secure Password Reset' : step === 2 ? 'Reset your password' : 'Check your email'} onClose={onClose}>
      {step === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Security</div>
            <h2 style={{ fontSize: 24, textTransform: 'uppercase', marginBottom: 20 }}>Security Settings</h2>
          </div>

          <div>
            <div className="eyebrow" style={{ marginBottom: 12 }}>Authentication Method</div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px',
              background: 'var(--surface)',
              border: '1.5px solid var(--signal)',
              borderRadius: 'var(--radius)',
              marginBottom: 16,
              cursor: 'pointer'
            }}>
              <div style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                border: '2px solid var(--signal)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--signal)' }} />
              </div>
              <span style={{ fontSize: 14 }}>Use Account Password</span>
            </div>
            <button className="btn btn-signal btn-block" onClick={() => setStep(1)}>Change Password</button>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px',
            background: 'var(--surface)',
            border: '1.5px solid var(--line)',
            borderRadius: 'var(--radius)',
            cursor: 'not-allowed',
            opacity: 0.6
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                border: '2px solid var(--line)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }} />
              <span style={{ fontSize: 14 }}>Enable 2-Step Verification</span>
            </div>
            <Badge status="INACTIVE" />
          </div>
        </div>
      )}

      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <PasswordInput
            label="Current Password"
            value={passwords.current}
            onChange={v => setPasswords(p => ({...p, current: v}))}
            required
          />
          <div style={{ position: 'relative' }}>
            <PasswordInput
              label="New Password"
              value={passwords.new}
              onChange={v => setPasswords(p => ({...p, new: v}))}
              required
            />
            <PasswordStrengthMeter password={passwords.new} />
          </div>
          <PasswordInput
            label="Confirm New Password"
            value={passwords.confirm}
            onChange={v => setPasswords(p => ({...p, confirm: v}))}
            required
          />
          <button className="btn btn-signal btn-block" style={{ marginTop: 12 }} onClick={handleReset}>Reset Password</button>
          <button
            className="btn btn-ghost btn-block"
            style={{ fontSize: 12, color:'var(--signal-ink)', textDecoration: 'underline' }}
            onClick={() => setStep(2)}
          >
            Forgot Current Password?
          </button>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, textAlign: 'center' }}>
          <div>
            <h2 style={{ fontSize: 20, marginBottom: 12 }}>Reset your password</h2>
            <p style={{ fontSize: 13, color: 'var(--steel)', marginBottom: 20 }}>
              Enter your email address below and we'll send you a password reset link so you can get back to your account.
            </p>
          </div>
          <Field label="Email">
            <TextInput
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              required
            />
          </Field>
          <button className="btn btn-signal btn-block" onClick={handleForgot}>RESET PASSWORD</button>
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--steel)' }}>
            or <br />
            Remember password? <span style={{ color:'var(--signal-ink)', cursor: 'pointer', fontWeight: 600 }} onClick={() => setStep(0)}>Log in</span>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, textAlign: 'center', alignItems: 'center' }}>
          <div style={{ fontSize: 48 }}>📧</div>
          <div>
            <h2 style={{ fontSize: 20, marginBottom: 12 }}>Check your email</h2>
            <p style={{ fontSize: 13, color: 'var(--steel)', marginBottom: 20 }}>
              We've sent a password reset link to <br />
              <b style={{ color: 'var(--ink)' }}>{email}</b>
            </p>
          </div>
          <button className="btn btn-outline btn-block" style={{ color:'var(--signal-ink)', borderColor: 'var(--signal)' }} onClick={onClose}>
            BACK TO LOG IN
          </button>
        </div>
      )}
    </Modal>
  );
}
