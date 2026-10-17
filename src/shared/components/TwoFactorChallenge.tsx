import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { Modal } from '../primitives/Modal.tsx';

type TwoFactorMode = 'setup' | 'challenge';

interface TwoFactorChallengeProps {
  mode: TwoFactorMode;
  email: string;
  onCancel: () => void;
  onVerified: () => void;
  onSendCode?: (email: string) => Promise<void>;
  onVerifyCode?: (code: string) => Promise<boolean>;
}

const DEMO_CODE = '123456';
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
  const [error, setError] = useState('');
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const initialSend = useRef<Promise<void> | null>(null);
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
      : new Promise<void>(resolve => window.setTimeout(resolve, 450));
    void initialSend.current
      .then(() => {
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
      if (onSendCode) await onSendCode(email);
      else await new Promise<void>(resolve => window.setTimeout(resolve, 450));
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
      const valid = onVerifyCode ? await onVerifyCode(code) : code === DEMO_CODE;
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
      title={isSetup ? 'Set Up Email Verification' : 'Two-Step Verification'}
      onClose={onCancel}
      className="two-factor-modal"
    >
      <div className="two-factor-content">
        <div className="two-factor-icon" aria-hidden="true">✉</div>
        <p className="two-factor-description">
          {isSetup
            ? 'Enter the 6-digit code to verify your email and enable two-step verification.'
            : 'Enter the 6-digit code sent to your email to finish signing in.'}
        </p>
        <p className="two-factor-email">{email || 'your account email'}</p>

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
          {isSending && <p className="two-factor-status">Sending verification code…</p>}
          {error && <p className="two-factor-error" role="alert">{error}</p>}
          {isVerified && <p className="two-factor-success">Email verified successfully.</p>}
          {!isSending && !error && !isVerified && (
            <p className="two-factor-demo">Demo mode: use code 123456.</p>
          )}
        </div>

        <button
          type="button"
          className="btn btn-signal btn-block"
          disabled={code.length !== 6 || isSending || isVerifying || isVerified}
          onClick={() => void handleVerify()}
        >
          {isVerifying ? 'Verifying…' : isVerified ? 'Verified' : 'Verify Code'}
        </button>

        <div className="two-factor-resend">
          <span>Didn’t receive a code?</span>
          <button
            type="button"
            className="two-factor-link"
            disabled={secondsRemaining > 0 || isSending}
            onClick={() => void handleResend()}
          >
            {isSending ? 'Sending…' : secondsRemaining > 0 ? `Resend in ${secondsRemaining}s` : 'Resend Code'}
          </button>
        </div>

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
