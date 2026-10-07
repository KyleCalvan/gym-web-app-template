import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Field, TextInput, Modal } from './shared';
import { dur, ease } from './motion.tsx';
import type { Member, Plan, Role, Setter } from './types.ts';

// Dedicated authentication route. Role-based: pick a role and sign in.
// Each role has its own prefilled demo credentials so reviewers can
// jump straight into the right dashboard.
//   • Member   → member@vinathletics.gym / member123
//   • Staff    → staff@vinathletics.gym  / staff123
//   • Trainer  → trainer@vinathletics.gym / trainer123
//   • Admin    → admin@vinathletics.gym  / admin123

interface RoleCred {
  email: string;
  password: string;
  label: string;
  hint: string;
}

const ROLE_CREDS: Record<Role, RoleCred> = {
  member:     { email: 'member@vinathletics.gym', password: 'member123', label: 'Member', hint: 'Demo: member@vinathletics.gym / member123' },
  staff:      { email: 'staff@vinathletics.gym', password: 'staff123', label: 'Staff', hint: 'Demo: staff@vinathletics.gym / staff123' },
  trainer:    { email: 'trainer@vinathletics.gym', password: 'trainer123', label: 'Trainer', hint: 'Demo: trainer@vinathletics.gym / trainer123' },
  admin:      { email: 'admin@vinathletics.gym', password: 'admin123', label: 'Admin', hint: 'Demo: admin@vinathletics.gym / admin123' },
  superadmin: { email: 'superadmin@vinathletics.gym', password: 'superadmin123', label: 'Super Admin', hint: 'Demo: superadmin@vinathletics.gym / superadmin123' },
};

export interface LoginPageProps {
  onLogin: (role: Role, userId?: string) => void;
  members: Member[];
  setMembers: Setter<Member[]>;
  plans: Plan[];
  defaultRole?: Role;
  defaultTab?: 'login' | 'register';
  onBack: () => void;
}

export default function LoginPage({
  onLogin, members, setMembers, plans, defaultRole = 'member', defaultTab = 'login', onBack,
}: LoginPageProps) {
  const [role, setRole] = useState<Role>(defaultRole);
  const [memberTab, setMemberTab] = useState<'login' | 'register'>(defaultTab);

  // Sign-in fields (prefilled per role)
  const [email, setEmail] = useState<string>(ROLE_CREDS[defaultRole].email);
  const [password, setPassword] = useState<string>(ROLE_CREDS[defaultRole].password);

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

  // "Fully read" is reached when the agreement is scrolled to the bottom.
  const handleTermsScroll = () => {
    const el = termsBodyRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 4) setTermsRead(true);
  };

  useEffect(() => {
    if (!termsOpen) return;
    // An agreement short enough to fit without scrolling counts as read on open.
    const el = termsBodyRef.current;
    if (el && el.scrollHeight - el.clientHeight < 4) setTermsRead(true);
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
    if (!/^\S+@\S+\.\S+$/.test(resetEmail)) {
      showToast('Please enter a valid email');
      return;
    }
    setForgotPasswordOpen(false);
    setResetSuccessOpen(true);
  };

  const closeResetFlow = () => {
    setForgotPasswordOpen(false);
    setResetSuccessOpen(false);
    setResetEmail('');
  };

  const pickRole = (r: Role) => {
    setRole(r);
    setEmail(ROLE_CREDS[r].email);
    setPassword(ROLE_CREDS[r].password);
  };

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) { showToast('Please enter a valid email'); return; }
    if (password.length < 6) { showToast('Password must be at least 6 characters'); return; }
    onLogin(role);
  };

  const handleMemberRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim()) { showToast('Name is required'); return; }
    if (!/^\S+@\S+\.\S+$/.test(regEmail)) { showToast('Please enter a valid email'); return; }
    if (regPassword.length < 8) { showToast('Password must be at least 8 characters'); return; }
    if (!termsRead) { showToast('Please read the Terms of Use first'); return; }
    if (!agreedToTerms) { showToast('You must agree to the Terms of Use'); return; }
    const id = 'M-' + (1042 + members.length);
    setMembers((prev) => [...prev, {
      id,
      name: regName.trim(),
      email: regEmail.trim(),
      phone: regPhone.trim(),
      plan: 'Premium',
      status: 'Active',
      joined: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
    }]);
    showToast('Welcome, ' + regName.trim() + '! Your member ID is ' + id);
    onLogin('member', id);
  };


  const item = (i: number) => ({
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.08 + i * 0.06, duration: dur.base, ease: ease.out },
  });

  const creds = ROLE_CREDS[role];

  return (
    <div className="auth-page">
      <nav className="auth-page-nav">
        <div className="brand"><img src="/logo.jpg" alt="VinAthletics" className="brand-mark-img" /> VinAthletics</div>
        <a onClick={onBack} style={{ cursor: 'pointer' }}>← Back to home</a>
      </nav>

      <div className="auth-page-body">
        <motion.div className="auth-page-aside" {...item(0)}>
          <div className="eyebrow">Sign in</div>
          <h2>Welcome back to the floor.</h2>
          <p>Pick your role and sign in to access its dashboard.</p>
          <ul>
            <li><b>Member</b> — track progress, sessions, payments.</li>
            <li><b>Staff</b> — front desk, point of sale, day-to-day ops.</li>
            <li><b>Trainer</b> — assigned sessions and availability.</li>
            <li><b>Admin</b> — full access to members, plans, reports, promotions.</li>
            <li><b>Super Admin</b> — user management, audit logs, backups, sessions.</li>
          </ul>
        </motion.div>

        <motion.div
          className="auth-card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: dur.slow, ease: ease.out }}
        >
          {/* Role selector — 5 roles (Member / Staff / Trainer / Admin / Super Admin) */}
          <div className="role-grid" style={{ marginBottom: 18 }}>
            {(['member','staff','trainer','admin','superadmin'] as const).map((r) => (
              <div
                key={r}
                className={"role-pick" + (role === r ? ' active' : '')}
                onClick={() => pickRole(r)}
                style={{ cursor: 'pointer' }}
              >{ROLE_CREDS[r].label}</div>
            ))}
          </div>

          <h2 style={{ fontSize: 20, textTransform: 'uppercase', marginBottom: 4 }}>
            {role === 'member' && memberTab === 'register' ? 'Create Account' : `${creds.label} Sign In`}
          </h2>
          <p style={{ color: 'var(--steel)', fontSize: 13, margin: '4px 0 14px' }}>
            {role === 'member'
              ? (memberTab === 'login' ? 'Access your member dashboard' : 'Join VinAthletics Gym today')
              : `Sign in to the ${creds.label} dashboard.`}
          </p>

          {role === 'member' && (
            <div className="auth-tabs" style={{ marginTop: 0 }}>
              <button type="button" className={memberTab === 'login' ? 'active' : ''} onClick={() => setMemberTab('login')}>Login</button>
              <button type="button" className={memberTab === 'register' ? 'active' : ''} onClick={() => setMemberTab('register')}>Register</button>
            </div>
          )}

          {role === 'member' && memberTab === 'register' ? (
            <form onSubmit={handleMemberRegister}>
              <Field label="Full Name">
                <input className="form-control" required placeholder="Your full name"
                  value={regName} onChange={(e) => setRegName(e.target.value)} />
              </Field>
              <Field label="Email">
                <input className="form-control" type="email" required placeholder="you@example.com"
                  value={regEmail} onChange={(e) => setRegEmail(e.target.value)} />
              </Field>
              <Field label="Phone">
                <input className="form-control" required placeholder="+63 9XX XXX XXXX"
                  value={regPhone} onChange={(e) => setRegPhone(e.target.value)} />
              </Field>
              <Field label="Password">
                <input className="form-control" type="password" required placeholder="At least 8 characters"
                  value={regPassword} onChange={(e) => setRegPassword(e.target.value)} />
              </Field>

              <div className="terms-row">
                <input
                  type="checkbox"
                  id="agree-terms"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                />
                <label htmlFor="agree-terms" className="terms-text">I have read and agree to the</label>
                <button
                  type="button"
                  className="terms-link"
                  onClick={() => setTermsOpen(true)}
                >
                  Terms of Use
                </button>
              </div>

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
          ) : (
            <form onSubmit={handleSignIn}>
              <Field label="Email">
                <input
                  className="form-control" type="email" required
                  placeholder="you@example.com"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field label="Password">
                <input
                  className="form-control" type="password" required
                  placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <div style={{ textAlign: 'right', marginBottom: 12 }}>
                <button
                  type="button"
                  className="btn-link-sm"
                  style={{ fontSize: 11, fontWeight: 'bold', color:'var(--signal-ink)', textTransform: 'uppercase', cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}
                  onClick={() => setForgotPasswordOpen(true)}
                >
                  Forgot Password
                </button>
              </div>
              <button type="submit" className="btn btn-signal btn-block">
                Sign In to {creds.label} Dashboard
              </button>
              {creds.hint && <p style={{ fontSize: 11.5, color: 'var(--steel)', marginTop: 12, textAlign: 'center' }}>{creds.hint}</p>}
            </form>
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
          <form onSubmit={handleResetPassword} style={{ padding: '0 24px 24px' }}>
            <p style={{ margin: '0 0 18px', color: 'var(--steel)', fontSize: 13, lineHeight: 1.6 }}>
              Enter your email address below and we'll send you a password reset link so you can get back to your account.
            </p>
            <Field label="EMAIL">
              <TextInput
                value={resetEmail}
                onChange={(v) => setResetEmail(v)}
                placeholder="you@example.com"
              />
            </Field>
            <button type="submit" className="btn btn-signal btn-block" style={{ marginTop: 12 }}>
              RESET PASSWORD
            </button>
            <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--steel)' }}>
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
            <p style={{ margin: '0 0 12px', fontSize: 15, lineHeight: 1.6 }}>
              We've sent a password reset link to <br />
              <strong style={{ color:'var(--signal-ink)' }}>{resetEmail}</strong>
            </p>
            <p style={{ margin: '0 0 24px', color: 'var(--steel)', fontSize: 13, lineHeight: 1.6 }}>
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
              <p className="terms-updated">Last updated: 26 August 2026</p>

              <p><strong>Who can use NorthGems</strong></p>
              <p>
                Vend Finder and GrowScan are for members of the NorthGems Discord server. You sign
                in with Discord, and we check that you are in our server. We re-check every few
                seconds, so if you leave the server you lose access straight away — you do not have
                to sign out first. Online Count is open to everyone.
              </p>

              <p><strong>What the data is — and what it is not</strong></p>
              <p>
                Our bots visit Growtopia worlds and record what vending machines are offering. Every
                price you see is a snapshot from the moment a bot was there, not a live feed. A
                world may have been re-priced, emptied, or locked since then. Always check in-game
                before you trade.
              </p>
              <p>
                We do not guarantee that the data is complete or correct, and we are not responsible
                for trades you make based on it.
              </p>

              <p><strong>Fair use</strong></p>
              <p>
                Each account has a daily search quota. Please do not script the site, scrape it,
                share your account, or try to work around the quota. Accounts that do can be
                suspended without warning.
              </p>

              <p><strong>Fixed prices &amp; haggling</strong></p>
              <p>
                Prices of listed packages are fixed and shown before you order. Asking staff for a
                lower price on a listed package (custom orders excepted) is not allowed. Each case
                gets a warning: the first 3 are warnings only; from the 4th, every warning adds +1%
                to your future orders. Repeated cases can lead to a ban from ordering.
              </p>

              <p><strong>Availability</strong></p>
              <p>
                NorthGems is a free tool run by a small team. There is no uptime guarantee —
                features can break, go down for maintenance, or change.
              </p>

              <p><strong>Changes</strong></p>
              <p>
                These terms can change. The date at the top tells you when they last did. Continuing
                to use the site means you accept the current version.
              </p>

              <p style={{ marginBottom: 0 }}>
                Questions go to discord.gg/northgems.
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
