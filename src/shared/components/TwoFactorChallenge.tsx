import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { Modal } from '../primitives/Modal.tsx';

type TwoFactorMode = 'setup' | 'challenge';

interface TwoFactorChallengeProps {
  mode: TwoFactorMode;
  email: string;
  onCancel: () => void;
  onVerified: () => void;
  onSendCode?: (email: string) => Promise<string>;
  onVerifyCode?: (code: string) => Promise<boolean>;
}

const RESEND_SECONDS = 60;

export function TwoFactorChallenge({
  mode,
  email,
  onCancel,
  onVerified,
  onSendCode,
  onVerifyCode,
}: TwoFactorChallengeProps) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [secondsRemaining, setSecondsRemaining] = useState(RESEND_SECONDS);
  const [isSending, setIsSending] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [setupSecret, setSetupSecret] = useState('');
  const [error, setError] = useState('');
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const initialSend = useRef<Promise<string> | null>(null);
  const code = digits.join('');

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSecondsRemaining(seconds => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    inputs.current[0]?.focus();
    let active = true;

    initialSend.current ??= onSendCode
      ? Promise.resolve().then(() => onSendCode(email))
      : Promise.resolve('');
    void initialSend.current
      .then((secret) => {
        if (active) setSetupSecret(secret);
        if (active) setSecondsRemaining(RESEND_SECONDS);
      })
      .catch(sendError => {
        if (active) {
          setSecondsRemaining(0);
          setError(sendError instanceof Error ? sendError.message : 'Could not send a verification code.');
        }
      })
      .finally(() => {
        if (active) setIsSending(false);
      });
    return () => { active = false; };
  }, [email, onSendCode]);

  const updateDigits = (nextDigits: string[]) => {
    setDigits(nextDigits);
    setError('');
    setIsVerified(false);
  };

  const handleChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const nextDigits = [...digits];
    nextDigits[index] = digit;
    updateDigits(nextDigits);
    if (digit && index < inputs.current.length - 1) inputs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      const nextDigits = [...digits];
      if (nextDigits[index]) {
        nextDigits[index] = '';
        updateDigits(nextDigits);
      } else if (index > 0) {
        nextDigits[index - 1] = '';
        updateDigits(nextDigits);
        inputs.current[index - 1]?.focus();
      }
    } else if (event.key === 'ArrowLeft' && index > 0) {
      inputs.current[index - 1]?.focus();
    } else if (event.key === 'ArrowRight' && index < inputs.current.length - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const nextDigits = Array(6).fill('');
    [...pasted].forEach((digit, index) => { nextDigits[index] = digit; });
    updateDigits(nextDigits);
    inputs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleResend = async () => {
    setIsSending(true);
    setError('');
    try {
      if (!onSendCode) throw new Error('Two-step setup is unavailable.');
      setSetupSecret(await onSendCode(email));
      setSecondsRemaining(RESEND_SECONDS);
      setDigits(Array(6).fill(''));
      inputs.current[0]?.focus();
    } catch (sendError) {
      setSecondsRemaining(0);
      setError(sendError instanceof Error ? sendError.message : 'Could not send a verification code.');
    } finally {
      setIsSending(false);
    }
  };

  const handleVerify = async () => {
    setIsVerifying(true);
    setError('');
    try {
      if (!onVerifyCode) throw new Error('Two-step verification is unavailable.');
      const valid = await onVerifyCode(code);
      if (!valid) {
        setError('Invalid or expired code. Check the code and try again.');
        return;
      }
      setIsVerified(true);
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Could not verify the code. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const isSetup = mode === 'setup';

  return (
    <Modal
      title={isSetup ? 'Set Up Two-Step Verification' : 'Two-Step Verification'}
      onClose={onCancel}
      className="two-factor-modal"
    >
      <div className="two-factor-content">
        <div className="two-factor-icon" aria-hidden="true">◆</div>
        <p className="two-factor-description">
          {isSetup
            ? 'Add the secret below to your authenticator app, then enter its 6-digit code.'
            : 'Enter the 6-digit code from your authenticator app to finish signing in.'}
        </p>
        <p className="two-factor-email">{isSetup ? setupSecret || 'Preparing your secret…' : email || 'Your account'}</p>

        <div className="otp-inputs" role="group" aria-label="6-digit verification code">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={element => { inputs.current[index] = element; }}
              className="otp-input"
              type="text"
              inputMode="numeric"
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              aria-label={`Digit ${index + 1} of 6`}
              maxLength={1}
              value={digit}
              disabled={isVerified}
              onChange={event => handleChange(index, event.target.value)}
              onKeyDown={event => handleKeyDown(index, event)}
              onPaste={handlePaste}
            />
          ))}
        </div>

        <div className="two-factor-feedback" aria-live="polite">
          {isSending && <p className="two-factor-status">Preparing authenticator setup…</p>}
          {error && <p className="two-factor-error" role="alert">{error}</p>}
          {isVerified && <p className="two-factor-success">Authenticator verified successfully.</p>}
        </div>

        <button
          type="button"
          className="btn btn-signal btn-block"
          disabled={code.length !== 6 || isSending || isVerifying || isVerified}
          onClick={() => void handleVerify()}
        >
          {isVerifying ? 'Verifying…' : isVerified ? 'Verified' : 'Verify Code'}
        </button>

        {isSetup && <div className="two-factor-resend">
          <span>Need a new secret?</span>
          <button
            type="button"
            className="two-factor-link"
            disabled={secondsRemaining > 0 || isSending}
            onClick={() => void handleResend()}
          >
            {isSending ? 'Preparing…' : secondsRemaining > 0 ? `Retry in ${secondsRemaining}s` : 'Generate New Secret'}
          </button>
        </div>}

        <div className="two-factor-actions">
          <button type="button" className="btn btn-outline btn-block" onClick={onCancel}>
            {isSetup ? 'Cancel' : 'Back to Login'}
          </button>
          {isVerified && (
            <button type="button" className="btn btn-signal btn-block" onClick={onVerified}>
              {isSetup ? 'Enable Two-Step Verification' : 'Continue to Dashboard'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
