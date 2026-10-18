import { useEffect, useState } from 'react';
import { Modal } from '../primitives/Modal.tsx';
import { TextInput } from '../primitives/TextInput';
import { Field } from '../primitives/Field';
import { Badge } from '../primitives/Badge';
import { PasswordInput } from './PasswordInput';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { TwoFactorChallenge } from './TwoFactorChallenge';
import { isTwoFactorEnabled, setTwoFactorEnabled } from './twoFactor';
import type { Role } from '../../types.ts';

interface SecurityFlowProps {
  isOpen: boolean;
  onClose: () => void;
  toast: (msg: string) => void;
  role: Role;
  accountEmail: string;
}

export function SecurityFlow({ isOpen, onClose, toast, role, accountEmail }: SecurityFlowProps) {
  const [step, setStep] = useState(0);
  const [showTwoFactorSetup, setShowTwoFactorSetup] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabledState] = useState(false);
  const [email, setEmail] = useState('');
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: '',
  });

  useEffect(() => {
    if (!isOpen) return;
    try {
      setTwoFactorEnabledState(isTwoFactorEnabled(role));
    } catch {
      toast('Could not load two-step verification settings.');
    }
  }, [isOpen, role, toast]);

  if (!isOpen) return null;

  const handleTwoFactorVerified = () => {
    try {
      setTwoFactorEnabled(role, true, accountEmail);
      setTwoFactorEnabledState(true);
      setShowTwoFactorSetup(false);
      toast('Two-step verification enabled.');
    } catch {
      toast('Could not save two-step verification settings.');
    }
  };

  const handleTwoFactorToggle = () => {
    if (!twoFactorEnabled) {
      setShowTwoFactorSetup(true);
      return;
    }
    try {
      setTwoFactorEnabled(role, false);
      setTwoFactorEnabledState(false);
      toast('Two-step verification disabled.');
    } catch {
      toast('Could not save two-step verification settings.');
    }
  };

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

  if (showTwoFactorSetup) {
    return (
      <TwoFactorChallenge
        mode="setup"
        email={accountEmail}
        onCancel={() => setShowTwoFactorSetup(false)}
        onVerified={handleTwoFactorVerified}
      />
    );
  }

  return (
    <Modal title={step === 0 ? 'Security Settings' : step === 1 ? 'Secure Password Reset' : step === 2 ? 'Reset your password' : 'Check your email'} onClose={onClose}>
      {step === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
              <span style={{ fontSize: 15.4 }}>Use Account Password</span>
            </div>
            <button className="btn btn-signal btn-block" onClick={() => setStep(1)}>Change Password</button>
          </div>

          <div className={`two-factor-setting${twoFactorEnabled ? ' enabled' : ''}`}>
            <div className="two-factor-setting-copy">
              <strong>2-Step Verification</strong>
              <span>
                {twoFactorEnabled
                  ? 'A verification code is required when you sign in.'
                  : 'Add an extra layer of security to your account.'}
              </span>
            </div>
            <Badge status={twoFactorEnabled ? 'Active' : 'INACTIVE'} />
            <button
              type="button"
              className={twoFactorEnabled ? 'btn btn-outline btn-sm' : 'btn btn-signal btn-sm'}
              onClick={handleTwoFactorToggle}
              aria-label={twoFactorEnabled ? 'Disable 2-Step Verification' : 'Enable 2-Step Verification'}
            >
              {twoFactorEnabled ? 'Disable' : 'Enable'}
            </button>
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
            style={{ fontSize: 13.2, color:'var(--signal-ink)', textDecoration: 'underline' }}
            onClick={() => setStep(2)}
          >
            Forgot Current Password?
          </button>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, textAlign: 'center' }}>
          <div>
            <h2 style={{ fontSize: 22, marginBottom: 12 }}>Reset your password</h2>
            <p style={{ fontSize: 14.3, color: 'var(--steel)', marginBottom: 20 }}>
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
          <div style={{ marginTop: 12, fontSize: 14.3, color: 'var(--steel)' }}>
            or <br />
            Remember password? <span style={{ color:'var(--signal-ink)', cursor: 'pointer', fontWeight: 600 }} onClick={() => setStep(0)}>Log in</span>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, textAlign: 'center', alignItems: 'center' }}>
          <div style={{ fontSize: 52.8 }}></div>
          <div>
            <h2 style={{ fontSize: 22, marginBottom: 12 }}>Check your email</h2>
            <p style={{ fontSize: 14.3, color: 'var(--steel)', marginBottom: 20 }}>
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
