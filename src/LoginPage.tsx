import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { getProviders, signIn } from 'next-auth/react';
import { Field, TextInput, Modal } from './shared';
import { dur, ease } from './motion.tsx';
import type { Member, Plan, Role, Setter } from './types.ts';
import { ROLE_LABEL } from './data.ts';

// Development demo credentials are fetched from a non-production server route.

interface RoleCred {
  email: string;
  password: string;
  label: string;
  hint: string;
}

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const OAUTH_ERRORS: Record<string, string> = {
  OAuthAccountNotLinked: 'This Google account is not linked to that user. Sign in with the existing method first, then use Google from your account.',
  AccessDenied: 'Google sign-in was cancelled or the Google account could not be verified.',
  OAuthSignin: 'Google sign-in could not be started. Please try again.',
  OAuthCallback: 'Google could not complete sign-in. Please try again.',
  Configuration: 'Google sign-in is not configured. Contact the site administrator.',
  Default: 'Google sign-in failed. Please try again or use email and password.',
};

export interface LoginPageProps {
  onLogin: (role: Role, userId?: string, member?: Member) => void;
  onDemoLogin: (session: { email: string; name: string; role: Role; roles: Role[]; expiresAt: number }) => void;
  members: Member[];
  setMembers: Setter<Member[]>;
  plans: Plan[];
  defaultRole?: Role;
  defaultTab?: 'login' | 'register';
  onBack: () => void;
}

export default function LoginPage({
  onLogin, onDemoLogin, members, setMembers, plans, defaultRole = 'member', defaultTab = 'login', onBack,
}: LoginPageProps) {
  const [role, setRole] = useState<Role>(defaultRole);
  const [memberTab, setMemberTab] = useState<'login' | 'register'>(defaultTab);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [googleProviderChecked, setGoogleProviderChecked] = useState(false);
  const [demoAccountsEnabled, setDemoAccountsEnabled] = useState(false);
  const [demoCredentials, setDemoCredentials] = useState<Partial<Record<Role, RoleCred>>>({});
  const [demoPending, setDemoPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);

  // Sign-in fields (prefilled per role)
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  // Register fields (member-only)
  const [regName, setRegName] = useState<string>('');
  const [regEmail, setRegEmail] = useState<string>('');
  const [regPhone, setRegPhone] = useState<string>('');
  const [regPassword, setRegPassword] = useState<string>('');

  // Terms & agreement gate on the register form. Create Account stays locked
  // until the member has both scrolled through the agreement and ticked the box.
  const [agreedToTerms, setAgreedToTerms] = useState<boolean>(false);
  const [termsOpen, setTermsOpen] = useState<boolean>(false);
  const [termsRead, setTermsRead] = useState<boolean>(false);
  const termsBodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('error');
    if (code) setGoogleError(OAUTH_ERRORS[code] ?? OAUTH_ERRORS.Default);
  }, []);

  useEffect(() => {
    let active = true;
    getProviders()
      .then((providers) => { if (active) setGoogleConfigured(Boolean(providers?.google)); })
      .catch(() => { if (active) setGoogleError('Could not load Google sign-in settings. Please try again later.'); })
      .finally(() => { if (active) setGoogleProviderChecked(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/api/demo-session')
      .then(async (response) => {
        if (!response.ok) return;
        const result: unknown = await response.json();
        if (active && result && typeof result === 'object' && 'enabled' in result) {
          setDemoAccountsEnabled(result.enabled === true);
          if ('accounts' in result && Array.isArray(result.accounts)) {
            const accounts = result.accounts.filter((account): account is {
              email: string; password: string; role: Role; name: string;
            } => account && typeof account.email === 'string'
              && typeof account.password === 'string'
              && typeof account.name === 'string'
              && ['member', 'staff', 'trainer', 'admin', 'superadmin'].includes(account.role));
            const credentials = Object.fromEntries(accounts.map((account) => [account.role, {
              email: account.email,
              password: account.password,
              label: ROLE_LABEL[account.role],
              hint: `Demo: ${account.email} / ${account.password}`,
            }])) as Partial<Record<Role, RoleCred>>;
            setDemoCredentials(credentials);
            const selected = credentials[defaultRole];
            if (selected) {
              setEmail(selected.email);
              setPassword(selected.password);
            }
          }
        }
      })
      .catch(() => {
        if (active) setDemoAccountsEnabled(false);
      });
    return () => { active = false; };
  }, []);

  const clearFieldError = (field: string) => {
    setFormErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  };

  const handleGoogleSignIn = async () => {
    setGoogleError(null);
    if (!googleConfigured) {
      setGoogleError('Google sign-in is not configured yet. Use email sign-in or ask the administrator to finish OAuth setup.');
      return;
    }
    setGooglePending(true);
    try {
      const result = await signIn('google', { callbackUrl: window.location.origin, redirect: false });
      if (result?.error || !result?.url) {
        setGoogleError(OAUTH_ERRORS[result?.error ?? ''] ?? OAUTH_ERRORS.Default);
        setGooglePending(false);
        return;
      }
      window.location.assign(result.url);
    } catch {
      setGoogleError('Could not connect to Google sign-in. Check your connection and try again.');
      setGooglePending(false);
    }
  };

  // "Fully read" is reached when the agreement is scrolled to the bottom.
  const handleTermsScroll = () => {
    const el = termsBodyRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 4) {
      setTermsRead(true);
      clearFieldError('terms');
    }
  };

  useEffect(() => {
    if (!termsOpen) return;
    // An agreement short enough to fit without scrolling counts as read on open.
    const el = termsBodyRef.current;
    if (el && el.scrollHeight - el.clientHeight < 4) {
      setTermsRead(true);
      clearFieldError('terms');
    }
  }, [termsOpen]);

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  // Reset Password Flow
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [resetSuccessOpen, setResetSuccessOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_PATTERN.test(resetEmail.trim())) {
      setFormErrors((prev) => ({ ...prev, 'reset-email': 'Enter a valid email address.' }));
      return;
    }
    clearFieldError('reset-email');
    setForgotPasswordOpen(false);
    setResetSuccessOpen(true);
  };

  const closeResetFlow = () => {
    setForgotPasswordOpen(false);
    setResetSuccessOpen(false);
    setResetEmail('');
    clearFieldError('reset-email');
  };

  const pickRole = (nextRole: Role) => {
    setRole(nextRole);
    setEmail(demoCredentials[nextRole]?.email || '');
    setPassword(demoCredentials[nextRole]?.password || '');
    setFormErrors({});
  };

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!EMAIL_PATTERN.test(email.trim())) errors['login-email'] = 'Enter a valid email address.';
    if (password.length < 6) errors['login-password'] = 'Password must be at least 6 characters.';
    if (Object.keys(errors).length) { setFormErrors(errors); return; }

    setFormErrors({});
    setDemoPending(true);
    void fetch('/api/demo-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    }).then(async (response) => {
      const result: unknown = await response.json();
      if (!response.ok) {
        const message = result && typeof result === 'object' && 'error' in result && typeof result.error === 'string'
          ? result.error
          : 'Demo sign in failed.';
        setFormErrors({ auth: message });
        return;
      }
      if (!result || typeof result !== 'object' || !('demoSession' in result)) {
        setFormErrors({ auth: 'The demo sign-in service returned an invalid response.' });
        return;
      }
      const session = result.demoSession;
      if (!session || typeof session !== 'object'
        || !('email' in session) || typeof session.email !== 'string'
        || !('name' in session) || typeof session.name !== 'string'
        || !('role' in session) || typeof session.role !== 'string'
        || !('roles' in session) || !Array.isArray(session.roles)
        || !('expiresAt' in session) || typeof session.expiresAt !== 'number') {
        setFormErrors({ auth: 'The demo sign-in service returned incomplete session details.' });
        return;
      }
      onDemoLogin(session as { email: string; name: string; role: Role; roles: Role[]; expiresAt: number });
    }).catch(() => {
      setFormErrors({ auth: 'Could not connect to demo sign in. Please try again.' });
    }).finally(() => setDemoPending(false));
  };

  const handleMemberRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!regName.trim()) errors['register-name'] = 'Enter your full name.';
    if (!EMAIL_PATTERN.test(regEmail.trim())) errors['register-email'] = 'Enter a valid email address.';
    if (!regPhone.trim()) errors['register-phone'] = 'Enter a phone number.';
    if (regPassword.length < 8) errors['register-password'] = 'Use at least 8 characters.';
    if (members.some((member) => member.email.trim().toLowerCase() === regEmail.trim().toLowerCase())) {
      errors['register-email'] = 'An account already exists for this email.';
    }
    if (!termsRead) errors.terms = 'Open and read the Terms of Use before continuing.';
    else if (!agreedToTerms) errors.terms = 'Accept the Terms of Use to create an account.';
    if (Object.keys(errors).length) { setFormErrors(errors); return; }

    setFormErrors({});
    const id = 'M-' + (1042 + members.length);
    const newMember: Member = {
      id,
      name: regName.trim(),
      email: regEmail.trim().toLowerCase(),
      phone: regPhone.trim(),
      plan: 'Premium',
      status: 'Active',
      joined: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
    };
    setMembers((prev) => [...prev, newMember]);
    showToast('Welcome, ' + regName.trim() + '! Your member ID is ' + id);
    onLogin('member', id, newMember);
  };


  const item = (i: number) => ({
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.08 + i * 0.06, duration: dur.base, ease: ease.out },
  });

  const creds: RoleCred = demoCredentials[role] || {
    email: '',
    password: '',
    label: ROLE_LABEL[role],
    hint: '',
  };

  return (
    <div className="auth-page">
      <nav className="auth-page-nav">
        <a
          className="brand auth-brand-link"
          href="/"
          aria-label="VinAthletics home"
          onClick={(e) => { e.preventDefault(); onBack(); }}
        >
          <img src="/logo.jpg" alt="" className="brand-mark-img" />
          <span>VinAthletics</span>
        </a>
      </nav>

      <div className="auth-page-body">
        <motion.div className="auth-page-aside" {...item(0)}>
          <div className="eyebrow">
            {role === 'member' && memberTab === 'register' ? 'Create account' : 'Sign in'}
          </div>
          <h2>
            {role === 'member' && memberTab === 'register'
              ? 'Your journey starts here.'
              : 'Welcome back to the floor.'}
          </h2>
          <p>
            {role === 'member' && memberTab === 'register'
              ? 'Start your fitness journey with everything you need in one place. Create your account to manage your training sessions, follow your progress, connect with your trainers, and stay on top of your fitness goals. Whether you’re just getting started or ready to take your training to the next level, this is where your journey begins.'
              : 'Stay on track with everything you need in one place. Sign in to manage your training sessions, track your progress, connect with your trainers, and keep your fitness goals within reach. Whether you’re continuing your journey or ready for your next challenge, this is where you pick up where you left off.'}
          </p>
        </motion.div>

        <motion.div
          className="auth-card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: dur.slow, ease: ease.out }}
        >
          <a
            className="auth-back-link"
            href="/"
            onClick={(e) => { e.preventDefault(); onBack(); }}
          >← Back to Home</a>
          {demoAccountsEnabled && !(role === 'member' && memberTab === 'register') && (
            <>
              <div className="role-grid" style={{ marginBottom: 10 }} role="group" aria-label="Choose demo role">
                {(['member', 'staff', 'trainer', 'admin', 'superadmin'] as const).map((availableRole) => (
                  <button
                    key={availableRole}
                    type="button"
                    className={`role-pick${role === availableRole ? ' active' : ''}`}
                    onClick={() => pickRole(availableRole)}
                    aria-pressed={role === availableRole}
                  >
                    {ROLE_LABEL[availableRole]}
                  </button>
                ))}
              </div>
              <p className="demo-account-notice">Development demo accounts only. Do not use these credentials in production.</p>
            </>
          )}
<h2 style={{ fontSize: 22, textTransform: 'uppercase', marginBottom: 4 }}>
            {role === 'member' && memberTab === 'register' ? 'Create Account' : `${creds.label} Sign In`}
          </h2>
          <p style={{ color: 'var(--steel)', fontSize: 14.3, margin: '4px 0 14px' }}>
            {role === 'member'
              ? (memberTab === 'login' ? 'Access your member dashboard' : 'Join VinAthletics Gym today')
              : `Sign in to the ${creds.label} dashboard.`}
          </p>

          
          {role === 'member' && (
            <div className="auth-tabs" style={{ marginTop: 0 }}>
              <button type="button" className={memberTab === 'login' ? 'active' : ''} onClick={() => { setMemberTab('login'); setFormErrors({}); }}>Login</button>
              <button type="button" className={memberTab === 'register' ? 'active' : ''} onClick={() => { setMemberTab('register'); setFormErrors({}); }}>Register</button>
            </div>
          )}

          {role === 'member' && memberTab === 'register' ? (
            <>
            <form onSubmit={handleMemberRegister} noValidate>
              <Field label="Full Name" htmlFor="register-name">
                <input id="register-name" className="form-control" required placeholder="Your full name"
                  aria-invalid={Boolean(formErrors['register-name'])}
                  aria-describedby={formErrors['register-name'] ? 'register-name-error' : undefined}
                  value={regName} onChange={(e) => { setRegName(e.target.value); clearFieldError('register-name'); }}
                  onBlur={() => { if (!regName.trim()) setFormErrors((prev) => ({ ...prev, 'register-name': 'Enter your full name.' })); }} />
                {formErrors['register-name'] && <p className="field-error" id="register-name-error" role="alert">{formErrors['register-name']}</p>}
              </Field>
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
            </form>
            <div className="auth-google-block">
              <div className="auth-divider"><span>or continue with</span></div>
              <button
                type="button"
                className="auth-google-button"
                onClick={handleGoogleSignIn}
                disabled={!googleProviderChecked || !googleConfigured || googlePending}
                aria-describedby={!googleProviderChecked || !googleConfigured ? 'google-provider-note' : undefined}
              >
                <span className="google-mark" aria-hidden="true">G</span>
                {googlePending ? 'Connecting to Google…' : 'Continue with Google'}
              </button>
              {(!googleProviderChecked || !googleConfigured) && (
                <p className="auth-provider-note" id="google-provider-note">
                  {!googleProviderChecked ? 'Checking Google sign-in availability…' : 'Google sign-in will be available when the administrator configures OAuth.'}
                </p>
              )}
              {googleError && <p className="field-error auth-provider-error" role="alert">{googleError}</p>}
            </div>
            </>
          ) : (
            <>
              <form onSubmit={handleSignIn} noValidate>
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
                  onClick={() => setForgotPasswordOpen(true)}
                >
                  Forgot Password
                </button>
              </div>
              {formErrors.auth && <p className="field-error" role="alert">{formErrors.auth}</p>}
              <button type="submit" className="btn btn-signal btn-block" disabled={!demoAccountsEnabled || demoPending}>
                {demoPending ? 'Signing in…' : `Sign In to ${creds.label} Dashboard`}
              </button>
              {!demoAccountsEnabled && <p className="auth-provider-note">Demo email sign-in is disabled in this environment. Use the configured sign-in provider.</p>}
              {demoAccountsEnabled && creds.hint && <p style={{ fontSize: 12.7, color: 'var(--steel)', marginTop: 12, textAlign: 'center' }}>{creds.hint}</p>}
            </form>
            {role === 'member' && (
              <div className="auth-google-block">
                <div className="auth-divider"><span>or continue with</span></div>
                <button
                  type="button"
                  className="auth-google-button"
                  onClick={handleGoogleSignIn}
                  disabled={!googleProviderChecked || !googleConfigured || googlePending}
                  aria-describedby={!googleProviderChecked || !googleConfigured ? 'google-provider-note' : undefined}
                >
                  <span className="google-mark" aria-hidden="true">G</span>
                  {googlePending ? 'Connecting to Google…' : 'Continue with Google'}
                </button>
                {(!googleProviderChecked || !googleConfigured) && (
                  <p className="auth-provider-note" id="google-provider-note">
                    {!googleProviderChecked ? 'Checking Google sign-in availability…' : 'Google sign-in will be available when the administrator configures OAuth.'}
                  </p>
                )}
                {googleError && <p className="field-error auth-provider-error" role="alert">{googleError}</p>}
              </div>
            )}
            </>
          )}
        </motion.div>
      </div>

      {toast && (
        <motion.div
          className="toast"
          initial={{ x: 24, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <span className="dot"></span>{toast}
        </motion.div>
      )}

      {forgotPasswordOpen && (
        <Modal title="Reset your password" className="modal-dark" onClose={closeResetFlow}>
          <form onSubmit={handleResetPassword} noValidate style={{ padding: '0 24px 24px' }}>
            <p style={{ margin: '0 0 18px', color: 'var(--steel)', fontSize: 14.3, lineHeight: 1.6 }}>
              Enter your email address below and we'll send you a password reset link so you can get back to your account.
            </p>
            <Field label="EMAIL" htmlFor="reset-email">
              <TextInput
                id="reset-email"
                type="email"
                value={resetEmail}
                onChange={(v) => { setResetEmail(v); clearFieldError('reset-email'); }}
                placeholder="you@example.com"
                aria-invalid={Boolean(formErrors['reset-email'])}
                aria-describedby={formErrors['reset-email'] ? 'reset-email-error' : undefined}
              />
              {formErrors['reset-email'] && <p className="field-error" id="reset-email-error" role="alert">{formErrors['reset-email']}</p>}
            </Field>
            <button type="submit" className="btn btn-signal btn-block" style={{ marginTop: 12 }}>
              RESET PASSWORD
            </button>
            <div style={{ textAlign: 'center', marginTop: 20, fontSize: 14.3, color: 'var(--steel)' }}>
              Remember password?{' '}
              <span
                style={{ color:'var(--signal-ink)', cursor: 'pointer', fontWeight: 'bold' }}
                onClick={closeResetFlow}
              >
                Log In
              </span>
            </div>
          </form>
        </Modal>
      )}

      {resetSuccessOpen && (
        <Modal title="Check your email" className="modal-dark" onClose={closeResetFlow}>
          <div style={{ padding: '0 24px 24px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 12px', fontSize: 16.5, lineHeight: 1.6 }}>
              We've sent a password reset link to <br />
              <strong style={{ color:'var(--signal-ink)' }}>{resetEmail}</strong>
            </p>
            <p style={{ margin: '0 0 24px', color: 'var(--steel)', fontSize: 14.3, lineHeight: 1.6 }}>
              Please check your inbox and follow the instructions to reset your password
            </p>
            <button
              className="btn btn-outline btn-block"
              onClick={closeResetFlow}
              style={{ borderColor: 'var(--signal)', color:'var(--signal-ink)' }}
            >
              BACK TO LOG IN
            </button>
          </div>
        </Modal>
      )}

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
              <p className="terms-updated">Last updated: 17 October 2026</p>

              <p><strong>Who can use VinAthletics</strong></p>
              <p>
                VinAthletics provides tools for gym members to manage their membership, training
                sessions, bookings, and progress, and for authorized staff and trainers to support
                those services. When you create an account, provide accurate information and keep
                your sign-in details private. You are responsible for activity under your account;
                contact us if you believe someone else has accessed it.
              </p>

              <p><strong>Using gym and fitness information</strong></p>
              <p>
                Plans, prices, trainer availability, schedules, and account information shown on the
                site are provided to help you manage your gym experience. Details and availability
                can change, and information may not always be current. Confirm important details
                with the gym before relying on them.
              </p>
              <p>
                The site is not medical advice and does not replace advice from a qualified health
                professional. Consider your health and fitness level before exercising, use
                equipment safely, and follow applicable instructions from gym staff and trainers.
                Stop exercising and seek appropriate help if you feel unwell or injured.
              </p>

              <p><strong>Memberships, bookings &amp; payments</strong></p>
              <p>
                Review the plan, session, and price shown before confirming a purchase or booking.
                Prices and availability may change. For questions about charges, changing or
                cancelling a booking or membership, or refund eligibility, contact the gym directly;
                any applicable terms provided at the time of purchase also apply.
              </p>

              <p><strong>Fair use</strong></p>
              <p>
                Use the site only for its intended gym and account-management purposes. Do not
                misuse the service, interfere with its operation, attempt unauthorized access, or
                access or change another person’s information. We may restrict or suspend access
                where necessary to protect members, the gym, or the service.
              </p>

              <p><strong>Availability</strong></p>
              <p>
                We work to keep VinAthletics available, but cannot guarantee uninterrupted or
                error-free access. Features may be unavailable during maintenance or due to
                technical issues, and the site may change over time.
              </p>

              <p><strong>Changes</strong></p>
              <p>
                We may update these terms as the service changes. The date above shows when they
                were last updated. By continuing to use VinAthletics after an update, you accept
                the revised terms.
              </p>

              <p style={{ marginBottom: 0 }}>
                Questions? Contact us at <a href="mailto:hello@vinathletics.gym">hello@vinathletics.gym</a> or
                <a href="tel:+639175550142"> +63 917 555 0142</a>.
              </p>
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
