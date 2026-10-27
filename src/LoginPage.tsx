import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { getProviders, signIn } from 'next-auth/react';
import { Field, Modal } from './shared';
import { dur, ease } from './motion';
import TermsOfUse from './auth/TermsOfUse';
import { NameFields } from './shared/components/NameFields';
import { emptyName, formatName } from './shared/nameParts';

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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [termsOpen, setTermsOpen] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [regName, setRegName] = useState(emptyName);
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
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
  const handleEmailSignIn = (event: React.FormEvent) => {
    event.preventDefault(); setError(null);
    const errors: Record<string, string> = {};
    if (!EMAIL_PATTERN.test(email.trim())) errors['login-email'] = 'Enter a valid email address.';
    if (password.length < 6) errors['login-password'] = 'Password must be at least 6 characters.';
    setFormErrors(errors);
    if (!Object.keys(errors).length) setError('Email and password sign-in is not connected yet. Continue with Google or contact the gym for assistance.');
  };
  const handleMemberRegister = (event: React.FormEvent) => {
    event.preventDefault(); setError(null);
    const errors: Record<string, string> = {};
    if (!regName.firstName.trim()) errors['register-firstName'] = 'Enter your first name.';
    if (!regName.lastName.trim()) errors['register-lastName'] = 'Enter your last name.';
    if (formatName(regName).length > 120) errors['register-lastName'] = 'Keep your full name within 120 characters.';
    if (!EMAIL_PATTERN.test(regEmail.trim())) errors['register-email'] = 'Enter a valid email address.';
    if (!regPhone.trim()) errors['register-phone'] = 'Enter a phone number.';
    if (regPassword.length < 8) errors['register-password'] = 'Use at least 8 characters.';
    if (!termsRead || !agreedToTerms) errors.terms = 'Read and accept the Terms of Use to continue.';
    setFormErrors(errors);
    if (!Object.keys(errors).length) setError('Email and password registration is not connected yet. Continue with Google or contact the gym for assistance.');
  };

  const registering = tab === 'register';
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('error');
    if (code) setError(OAUTH_ERRORS[code] ?? OAUTH_ERRORS.Default);
    let active = true;
    getProviders()
      .then(providers => { if (active) setConfigured(Boolean(providers?.google)); })
      .catch(() => { if (active) setError('Could not load sign-in settings. Please try again later.'); })
      .finally(() => { if (active) setChecked(true); });
    return () => { active = false; };
  }, []);
  const handleSignIn = async () => {
    if (!configured || pending) return;
    setError(null); setPending(true);
    try {
      const result = await signIn('google', { callbackUrl: window.location.origin, redirect: false });
      if (result?.error || !result?.url) {
        setError(OAUTH_ERRORS[result?.error ?? ''] ?? OAUTH_ERRORS.Default); setPending(false); return;
      }
      window.location.assign(result.url);
    } catch {
      setError('Could not connect to Google sign-in. Check your connection and try again.'); setPending(false);
    }
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
                <input id="register-email" className="form-control" type="email" required placeholder="you@example.com"
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
                  onBlur={() => { if (!regPhone.trim()) setFormErrors((prev) => ({ ...prev, 'register-phone': 'Enter a phone number.' })); }} />
                {formErrors['register-phone'] && <p className="field-error" id="register-phone-error" role="alert">{formErrors['register-phone']}</p>}
              </Field>
              <Field label="Password" htmlFor="register-password">
                <input id="register-password" className="form-control" type="password" required placeholder="At least 8 characters"
                  aria-invalid={Boolean(formErrors['register-password'])}
                  aria-describedby={formErrors['register-password'] ? 'register-password-error' : undefined}
                  value={regPassword} onChange={(e) => { setRegPassword(e.target.value); clearFieldError('register-password'); }}
                  onBlur={() => { if (regPassword.length < 8) setFormErrors((prev) => ({ ...prev, 'register-password': 'Use at least 8 characters.' })); }} />
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
                disabled={!termsRead || !agreedToTerms}
              >
                Create Account
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
                  id="login-email" className="form-control" type="email" required
                  placeholder="you@example.com"
                  aria-invalid={Boolean(formErrors['login-email'])}
                  aria-describedby={formErrors['login-email'] ? 'login-email-error' : undefined}
                  value={email} onChange={(e) => { setEmail(e.target.value); clearFieldError('login-email'); }}
                  onBlur={() => { if (!EMAIL_PATTERN.test(email.trim())) setFormErrors((prev) => ({ ...prev, 'login-email': 'Enter a valid email address.' })); }}
                />
                {formErrors['login-email'] && <p className="field-error" id="login-email-error" role="alert">{formErrors['login-email']}</p>}
              </Field>
              <Field label="Password" htmlFor="login-password">
                <input
                  id="login-password" className="form-control" type="password" required
                  placeholder="••••••••"
                  aria-invalid={Boolean(formErrors['login-password'])}
                  aria-describedby={formErrors['login-password'] ? 'login-password-error' : undefined}
                  value={password} onChange={(e) => { setPassword(e.target.value); clearFieldError('login-password'); }}
                  onBlur={() => { if (password.length < 6) setFormErrors((prev) => ({ ...prev, 'login-password': 'Password must be at least 6 characters.' })); }}
                />
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
              <button type="submit" className="btn btn-signal btn-block" disabled={pending}>
                {pending ? 'Signing in…' : 'Login'}
              </button>
            </form>)}
          <div className="auth-divider"><span>or continue with</span></div>
          <button type="button" className="auth-google-button" onClick={handleSignIn} disabled={!checked || !configured || pending} aria-describedby={!checked || !configured ? 'google-provider-note' : undefined}>
            <span className="google-mark" aria-hidden="true">G</span>{pending ? 'Connecting to Google…' : 'Continue with Google'}
          </button>
          {(!checked || !configured) && <p className="auth-provider-note" id="google-provider-note">{!checked ? 'Checking sign-in availability…' : 'Google sign-in is currently unavailable. Please contact the gym for assistance.'}</p>}
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
