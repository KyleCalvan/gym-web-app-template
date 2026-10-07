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
    if (!termsRead) { showToast('Please read the Terms and Agreements first'); return; }
    if (!agreedToTerms) { showToast('You must agree to the Terms and Agreements'); return; }
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
                  Terms and Agreements
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
                  Open and scroll through the Terms and Agreements to unlock the button.
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
                  style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--signal)', textTransform: 'uppercase', cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}
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
                style={{ color: 'var(--signal)', cursor: 'pointer', fontWeight: 'bold' }}
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
              <strong style={{ color: 'var(--signal)' }}>{resetEmail}</strong>
            </p>
            <p style={{ margin: '0 0 24px', color: 'var(--steel)', fontSize: 13, lineHeight: 1.6 }}>
              Please check your inbox and follow the instructions to reset your password
            </p>
            <button
              className="btn btn-outline btn-block"
              onClick={closeResetFlow}
              style={{ borderColor: 'var(--signal)', color: 'var(--signal)' }}
            >
              BACK TO LOG IN
            </button>
          </div>
        </Modal>
      )}

      {termsOpen && (
        <Modal
          title="Terms and Agreements"
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
              <p><strong>1. Acceptance of Terms</strong></p>
              <p>
                By registering a VinAthletics account you accept this agreement in full. If you do
                not accept any part of it, do not create an account. Membership is offered by
                VinAthletics Gym, Makati, Philippines ("the Gym", "we").
              </p>

              <p><strong>2. Membership &amp; Billing</strong></p>
              <p>
                Your chosen membership plan begins on the date of activation and renews
                automatically at the stated rate until cancelled by either party. Dues are billed in
                advance and are non-transferable. A returned payment or declined card places the
                account on hold until settled; access to the floor is suspended while a balance is
                outstanding.
              </p>

              <p><strong>3. Health &amp; Assumption of Risk</strong></p>
              <p>
                Exercise carries inherent risk. You confirm that you are in suitable physical
                condition to train and that you have consulted a physician where any doubt exists.
                You assume all risk of injury, illness or loss arising from your use of the
                equipment, classes and facilities, and you release the Gym, its owners, trainers and
                staff from any claim arising from such use except where caused by our gross
                negligence.
              </p>

              <p><strong>4. Code of Conduct</strong></p>
              <p>
                Members train in a shared space. Harassment, intimidation, misuse of equipment,
                training under the influence, or disregard for staff instruction will result in
                immediate removal and, at our discretion, termination of membership without refund.
              </p>

              <p><strong>5. Cancellation, Freeze &amp; Refunds</strong></p>
              <p>
                You may cancel a membership at any time from your profile; cancellation takes effect
                at the end of the current billing period and stops the next renewal. Prepaid months
                are not refunded for partial use. Accounts may be frozen for medical or travel
                reasons for a maximum of three months per membership year.
              </p>

              <p><strong>6. Personal Belongings &amp; Liability</strong></p>
              <p>
                Lockers are provided for the session only. The Gym is not liable for lost, stolen or
                damaged property on the premises, including items left overnight.
              </p>

              <p><strong>7. Privacy &amp; Personal Data</strong></p>
              <p>
                We collect your name, contact details, health disclosures and payment information
                solely to operate your membership — check-ins, coaching bookings, billing and
                emergency contact. We do not sell your data. Deleting your account removes your
                record from the active ledger.
              </p>

              <p><strong>8. Changes to These Terms</strong></p>
              <p>
                We may revise this agreement as our services or the law changes; material changes
                are notified to the email on file, and continued use after notice is acceptance.
              </p>

              <p style={{ marginBottom: 0 }}>
                Questions about this agreement may be raised with front desk staff or written to
                management at any time.
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
