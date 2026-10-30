import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { Field, Modal } from './shared';
import { dur, ease } from './motion';
import TermsOfUse from './auth/TermsOfUse';
import { CURRENT_TERMS_VERSION } from './auth/terms';
import { NameFields } from './shared/components/NameFields';
import { emptyName, formatName } from './shared/nameParts';
import { normalizeRegistrationPhone } from './auth/registration-phone';

const OAUTH_ERRORS: Record<string, string> = {
  AccountConflict: 'Your Google identity needs review. Contact the gym to resolve the account link before trying again.',
  OAuthAccountNotLinked: 'This Google account is not linked to that user. Sign in with the existing method first.',
  AccessDenied: 'Google sign-in was cancelled or the account could not be verified.',
  OAuthSignin: 'Google sign-in could not be started. Please try again.',
  OAuthCallback: 'Google could not complete sign-in. Please try again.',
  Configuration: 'Google sign-in is not configured. Contact the gym for assistance.',
  Default: 'Google sign-in failed. Please try again.',
};
export interface LoginPageProps { defaultTab?: 'login' | 'register'; onBack: () => void; }
export default function LoginPage({ defaultTab = 'login', onBack }: LoginPageProps) {
  const [tab, setTab] = useState(defaultTab);
  const [configured, setConfigured] = useState(false);
  const [checked, setChecked] = useState(false);
  const [pendingMethod, setPendingMethod] = useState<'password' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [termsOpen, setTermsOpen] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [regName, setRegName] = useState(emptyName);
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [termsRead, setTermsRead] = useState(false);
  const termsBodyRef = useRef<HTMLDivElement | null>(null);
  const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
  const clearFieldError = (field: string) => setFormErrors(previous => {
    const next = {...previous}; delete next[field]; return next;
  });
  const handleTermsScroll = () => {
    const el = termsBodyRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 4) setTermsRead(true);
  };
  useEffect(() => {
    if (termsOpen) handleTermsScroll();
  }, [termsOpen]);
  const handleEmailSignIn = async (event: React.FormEvent) => {
    event.preventDefault(); setError(null);
    if (pendingMethod) return;
    const errors: Record<string, string> = {};
    if (!EMAIL_PATTERN.test(email.trim())) errors['login-email'] = 'Enter a valid email address.';
    if (!password || password.length > 128) errors['login-password'] = 'Enter your password.';
    setFormErrors(errors);
    if (Object.keys(errors).length) return;
    setPendingMethod('password');
    try {
      const response = await fetch('/api/password-login', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const result: { code?: string; message?: string; error?: string; next?: string } = await response.json();
      if (!response.ok) {
        setError(result.message ?? result.error ?? 'Sign-in could not be completed. Please retry.');
        return;
      }
      window.location.assign('/account');
    } catch {
      setError('Could not connect to sign-in. Check your connection and retry.');
    } finally {
      setPendingMethod(null);
    }
  };
  const handleMemberRegister = async (event: React.FormEvent) => {
    event.preventDefault(); setError(null);
    if (pendingMethod) return;
    const errors: Record<string, string> = {};
    if (!regName.firstName.trim()) errors['register-firstName'] = 'Enter your first name.';
    if (!regName.lastName.trim()) errors['register-lastName'] = 'Enter your last name.';
    if (formatName(regName).length > 120) errors['register-lastName'] = 'Keep your full name within 120 characters.';
    if (!EMAIL_PATTERN.test(regEmail.trim())) errors['register-email'] = 'Enter a valid email address.';
    if (!normalizeRegistrationPhone(regPhone)) errors['register-phone'] = 'Enter a phone number with 7 to 15 digits.';
    if (regPassword.length < 8 || regPassword.length > 128) errors['register-password'] = 'Use 8 to 128 characters.';
    if (!termsRead || !agreedToTerms) errors.terms = 'Read and accept the Terms of Use to continue.';
    setFormErrors(errors);
    if (Object.keys(errors).length) return;
    setPendingMethod('password');
    try {
      const response = await fetch('/api/register', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...regName, email: regEmail.trim(), phone: regPhone.trim(), password: regPassword,
          termsAccepted: agreedToTerms, termsVersion: CURRENT_TERMS_VERSION }),
      });
      const result: { code?: string; message?: string; next?: string } = await response.json();
      if (!response.ok) {
        if (result.code === 'ACCOUNT_EXISTS' || result.code === 'INVALID_EMAIL')
          setFormErrors(previous => ({ ...previous, 'register-email': result.message ?? 'Enter a valid email address.' }));
        else if (result.code === 'INVALID_PHONE')
          setFormErrors(previous => ({ ...previous, 'register-phone': result.message ?? 'Enter a phone number with 7 to 15 digits.' }));
        else if (result.code === 'INVALID_PASSWORD')
          setFormErrors(previous => ({ ...previous, 'register-password': result.message ?? 'Use a password of 8 to 128 characters.' }));
        else setError(result.message ?? 'Registration could not be completed. Please retry.');
        return;
      }
      window.location.assign(result.next?.startsWith('/account') ? result.next : '/account');
    } catch {
      setError('Could not connect to registration. Check your connection and retry.');
    } finally {
      setPendingMethod(null);
    }
  };

  const registering = tab === 'register';
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('error');
    if (code) setError(OAUTH_ERRORS[code] ?? OAUTH_ERRORS.Default);
    let active = true;
    fetch('/api/supabase/google/status', { cache: 'no-store' })
      .then(response => response.json())
      .then((status: { google?: boolean }) => { if (active) setConfigured(status.google === true); })
      .catch(() => { if (active) setError('Could not load sign-in settings. Please try again later.'); })
      .finally(() => { if (active) setChecked(true); });
    return () => { active = false; };
  }, []);
  const handleSignIn = async () => {
    if (!configured || pendingMethod) return;
    setError(null); setPendingMethod('google');
    window.location.assign('/api/supabase/google');
  };
  return (
    <div className="auth-page">
      <nav className="auth-page-nav">
        <a className="brand auth-brand-link" href="/" aria-label="VinAthletics home" onClick={e => { e.preventDefault(); onBack(); }}>
          <img src="/logo.jpg" alt="" className="brand-mark-img" /><span>VinAthletics</span>
        </a>
      </nav>
      <div className="auth-page-body">
        <motion.div className="auth-page-aside" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: dur.base, ease: ease.out }}>
          <h2>{registering ? 'Your journey starts here.' : 'Welcome back to the floor.'}</h2>
          <p>{registering
            ? 'Create your account to manage your training sessions, follow your progress, and connect with your trainers.'
            : 'Sign in to manage your training sessions, track your progress, and stay connected with your gym.'}</p>
        </motion.div>
        <motion.div className="auth-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: dur.slow, ease: ease.out }}>
          <a className="auth-back-link" href="/" onClick={e => { e.preventDefault(); onBack(); }}>← Back to Home</a>
          <h1 style={{ fontSize: 26, textTransform: 'uppercase', marginBottom: 4 }}>{registering ? 'Create Account' : 'Login'}</h1>
          <p style={{ color: 'var(--steel)', fontSize: 14.3, margin: '4px 0 14px' }}>{registering ? 'Join VinAthletics Gym today' : 'Access your VinAthletics account'}</p>
          <div className="auth-tabs" style={{ marginTop: 0 }}>
            <button type="button" className={!registering ? 'active' : ''} aria-pressed={!registering} onClick={() => { setTab('login'); setFormErrors({}); setError(null); }}>Login</button>
            <button type="button" className={registering ? 'active' : ''} aria-pressed={registering} onClick={() => { setTab('register'); setFormErrors({}); setError(null); }}>Register</button>
          </div>
          {registering ? (<form onSubmit={handleMemberRegister} noValidate>
              <NameFields prefix="register" value={regName} onChange={parts => {
                setRegName(parts);
                setFormErrors(previous => {
                  const next = {...previous};
                  if (parts.firstName.trim()) delete next['register-firstName'];
                  if (parts.lastName.trim()) delete next['register-lastName'];
                  return next;
                });
              }} errors={formErrors} />
              <Field label="Email" htmlFor="register-email">
                <input id="register-email" className="form-control" type="email" required autoComplete="username" placeholder="you@example.com"
                  aria-invalid={Boolean(formErrors['register-email'])}
                  aria-describedby={formErrors['register-email'] ? 'register-email-error' : undefined}
                  value={regEmail} onChange={(e) => { setRegEmail(e.target.value); clearFieldError('register-email'); }}
                  onBlur={() => { if (!EMAIL_PATTERN.test(regEmail.trim())) setFormErrors((prev) => ({ ...prev, 'register-email': 'Enter a valid email address.' })); }} />
                {formErrors['register-email'] && <p className="field-error" id="register-email-error" role="alert">{formErrors['register-email']}</p>}
              </Field>
              <Field label="Phone" htmlFor="register-phone">
                <input id="register-phone" className="form-control" type="tel" required placeholder="+63 9XX XXX XXXX"
                  aria-invalid={Boolean(formErrors['register-phone'])}
                  aria-describedby={formErrors['register-phone'] ? 'register-phone-error' : undefined}
                  value={regPhone} onChange={(e) => { setRegPhone(e.target.value); clearFieldError('register-phone'); }}
                  onBlur={() => { if (!normalizeRegistrationPhone(regPhone)) setFormErrors((prev) => ({ ...prev, 'register-phone': 'Enter a phone number with 7 to 15 digits.' })); }} />
                {formErrors['register-phone'] && <p className="field-error" id="register-phone-error" role="alert">{formErrors['register-phone']}</p>}
              </Field>
              <Field label="Password" htmlFor="register-password">
                <div className="password-control">
                <input id="register-password" className="form-control" type={showRegisterPassword ? 'text' : 'password'} required autoComplete="new-password" placeholder="At least 8 characters"
                  aria-invalid={Boolean(formErrors['register-password'])}
                  aria-describedby={formErrors['register-password'] ? 'register-password-error' : undefined}
                  value={regPassword} onChange={(e) => { setRegPassword(e.target.value); clearFieldError('register-password'); }}
                  onBlur={() => { if (regPassword.length < 8) setFormErrors((prev) => ({ ...prev, 'register-password': 'Use at least 8 characters.' })); }} />
                <button type="button" className="password-visibility-toggle" aria-label={showRegisterPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showRegisterPassword} aria-controls="register-password"
                  onPointerDown={event => { event.preventDefault(); setShowRegisterPassword(value => !value); }}
                  onClick={event => { if (event.detail === 0) setShowRegisterPassword(value => !value); }}>
                  {showRegisterPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
                </button>
                </div>
                {formErrors['register-password'] && <p className="field-error" id="register-password-error" role="alert">{formErrors['register-password']}</p>}
              </Field>

              <div className="terms-row">
                <input
                  type="checkbox"
                  id="agree-terms"
                  checked={agreedToTerms}
                  aria-invalid={Boolean(formErrors.terms)}
                  aria-describedby={formErrors.terms ? 'terms-error' : undefined}
                  onChange={(e) => { setAgreedToTerms(e.target.checked); if (e.target.checked) clearFieldError('terms'); }}
                />
                <div className="terms-copy">
                  <label htmlFor="agree-terms" className="terms-text">I have read and agree to the</label>
                  <button
                    type="button"
                    className="terms-link"
                    onClick={() => setTermsOpen(true)}
                  >Terms of Use</button>
                </div>
              </div>
              {formErrors.terms && <p className="field-error terms-error" id="terms-error" role="alert">{formErrors.terms}</p>}

              <button
                type="submit"
                className="btn btn-signal btn-block"
                disabled={!termsRead || !agreedToTerms || pendingMethod !== null}
              >
                {pendingMethod === 'password' ? 'Creating Account…' : 'Create Account'}
              </button>
              {!termsRead ? (
                <p className="terms-hint">
                  Open and scroll through the Terms of Use to unlock the button.
                </p>
              ) : !agreedToTerms ? (
                <p className="terms-hint">Tick the agreement box above to continue.</p>
              ) : null}
            </form>) : (<form onSubmit={handleEmailSignIn} noValidate>
              <Field label="Email" htmlFor="login-email">
                <input
                  id="login-email" className="form-control" type="email" required autoComplete="username"
                  placeholder="you@example.com"
                  aria-invalid={Boolean(formErrors['login-email'])}
                  aria-describedby={formErrors['login-email'] ? 'login-email-error' : undefined}
                  value={email} onChange={(e) => { setEmail(e.target.value); clearFieldError('login-email'); }}
                  onBlur={() => { if (!EMAIL_PATTERN.test(email.trim())) setFormErrors((prev) => ({ ...prev, 'login-email': 'Enter a valid email address.' })); }}
                />
                {formErrors['login-email'] && <p className="field-error" id="login-email-error" role="alert">{formErrors['login-email']}</p>}
              </Field>
              <Field label="Password" htmlFor="login-password">
                <div className="password-control">
                <input
                  id="login-password" className="form-control" type={showLoginPassword ? 'text' : 'password'} required autoComplete="current-password"
                  placeholder="••••••••"
                  aria-invalid={Boolean(formErrors['login-password'])}
                  aria-describedby={formErrors['login-password'] ? 'login-password-error' : undefined}
                  value={password} onChange={(e) => { setPassword(e.target.value); clearFieldError('login-password'); }}
                  onBlur={() => { if (!password || password.length > 128) setFormErrors((prev) => ({ ...prev, 'login-password': 'Enter your password.' })); }}
                />
                <button type="button" className="password-visibility-toggle" aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showLoginPassword} aria-controls="login-password"
                  onPointerDown={event => { event.preventDefault(); setShowLoginPassword(value => !value); }}
                  onClick={event => { if (event.detail === 0) setShowLoginPassword(value => !value); }}>
                  {showLoginPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
                </button>
                </div>
                {formErrors['login-password'] && <p className="field-error" id="login-password-error" role="alert">{formErrors['login-password']}</p>}
              </Field>
              <div style={{ textAlign: 'right', marginBottom: 12 }}>
                <button
                  type="button"
                  className="btn-link-sm"
                  style={{ fontSize: 12.1, fontWeight: 'bold', color:'var(--signal-ink)', textTransform: 'uppercase', cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}
                  onClick={() => setError('Password recovery is not available yet. Please contact the gym for assistance.')}

                >
                  Forgot Password
                </button>
              </div>
              {formErrors.auth && <p className="field-error" role="alert">{formErrors.auth}</p>}
              <button type="submit" className="btn btn-signal btn-block" disabled={Boolean(pendingMethod)}>
                {pendingMethod === 'password' ? 'Signing in…' : 'Login'}
              </button>
            </form>)}
          <div className="auth-divider"><span>or continue with</span></div>
          <button type="button" className="auth-google-button" onClick={handleSignIn} disabled={!checked || !configured || Boolean(pendingMethod)} aria-describedby={!checked || !configured ? 'google-provider-note' : undefined}>
            <span className="google-mark" aria-hidden="true">G</span>{pendingMethod === 'google' ? 'Connecting to Google…' : registering ? 'Sign up with Google' : 'Continue with Google'}
          </button>
          {(!checked || !configured) && <p className="auth-provider-note" id="google-provider-note">{!checked ? 'Checking sign-in availability…' : `Google ${registering ? 'sign-up' : 'sign-in'} is currently unavailable. Please contact the gym for assistance.`}</p>}
          {error && <p className="field-error auth-provider-error" role="alert">{error}</p>}
        </motion.div>
      </div>
      {termsOpen && (
        <Modal
          title="Terms of Use"
          className="modal-dark"
          wide
          onClose={() => setTermsOpen(false)}
        >
          <div style={{ padding: '0 24px 20px' }}>
            <div
              ref={termsBodyRef}
              onScroll={handleTermsScroll}
              className="terms-body"
              role="region"
              aria-label="Membership agreement"
              tabIndex={0}
            >
              <TermsOfUse />
            </div>

            <div className="terms-foot">
              {!termsRead ? (
                <span className="terms-progress">Scroll to the bottom to acknowledge you've read it.</span>
              ) : (
                <span className="terms-progress done">✓ Read — you can now agree and continue.</span>
              )}
              <button
                type="button"
                className="btn btn-signal btn-sm"
                onClick={() => setTermsOpen(false)}
                style={{ width: 'auto' }}
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
