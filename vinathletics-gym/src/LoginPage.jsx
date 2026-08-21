import { useState } from 'react';
import { motion } from 'framer-motion';
import { Field, TextInput } from './components.jsx';
import { dur, ease } from './motion.jsx';

// Dedicated authentication route. Role-based: pick a role and sign in.
// Each role has its own prefilled demo credentials so reviewers can
// jump straight into the right dashboard.
//   • Member   → member@vinathletics.gym / member123
//   • Staff    → staff@vinathletics.gym  / staff123
//   • Trainer  → trainer@vinathletics.gym / trainer123
//   • Admin    → admin@vinathletics.gym  / admin123

const ROLE_CREDS = {
  member:  {email:'member@vinathletics.gym',  password:'member123',  label:'Member',  hint:'Demo: member@vinathletics.gym / member123'},
  staff:   {email:'staff@vinathletics.gym',   password:'staff123',   label:'Staff',   hint:'Demo: staff@vinathletics.gym / staff123'},
  trainer: {email:'trainer@vinathletics.gym', password:'trainer123', label:'Trainer', hint:'Demo: trainer@vinathletics.gym / trainer123'},
  admin:   {email:'admin@vinathletics.gym',   password:'admin123',   label:'Admin',   hint:'Demo: admin@vinathletics.gym / admin123'},
};

export default function LoginPage({ onLogin, members, setMembers, defaultRole = 'member', defaultTab = 'login', onBack }){
  const [role, setRole] = useState(defaultRole);
  const [memberTab, setMemberTab] = useState(defaultTab);

  // Sign-in fields (prefilled per role)
  const [email, setEmail] = useState(ROLE_CREDS[defaultRole].email);
  const [password, setPassword] = useState(ROLE_CREDS[defaultRole].password);

  // Register fields (member-only)
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [toast, setToast] = useState(null);
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(()=>setToast(null), 2600);
  };

  const pickRole = (r) => {
    setRole(r);
    setEmail(ROLE_CREDS[r].email);
    setPassword(ROLE_CREDS[r].password);
  };

  const handleSignIn = (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) { showToast('Please enter a valid email'); return; }
    if (password.length < 6) { showToast('Password must be at least 6 characters'); return; }
    onLogin(role);
  };

  const handleMemberRegister = (e) => {
    e.preventDefault();
    if (!regName.trim()) { showToast('Name is required'); return; }
    if (!/^\S+@\S+\.\S+$/.test(regEmail)) { showToast('Please enter a valid email'); return; }
    if (regPassword.length < 8) { showToast('Password must be at least 8 characters'); return; }
    const id = 'M-' + (1042 + members.length);
    setMembers(prev => [...prev, {
      id,
      name: regName.trim(),
      email: regEmail.trim(),
      phone: regPhone.trim(),
      plan: 'Premium',
      status: 'Active',
      joined: new Date().toLocaleDateString('en-US', {month:'short', day:'2-digit', year:'numeric'}),
    }]);
    showToast('Welcome, ' + regName.trim() + '! Your member ID is ' + id);
    onLogin('member', id);
  };

  const item = (i) => ({
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.08 + i * 0.06, duration: dur.base, ease: ease.out },
  });

  const creds = ROLE_CREDS[role];

  return (
    <div className="auth-page">
      <nav className="auth-page-nav">
        <div className="brand"><span className="brand-mark">🏋</span> VinAthletics</div>
        <a onClick={onBack} style={{cursor:'pointer'}}>← Back to home</a>
      </nav>

      <div className="auth-page-body">
        <motion.div className="auth-page-aside" {...item(0)}>
          <div className="eyebrow">Sign in</div>
          <h2>Welcome back to the floor.</h2>
          <p>Pick your role and sign in. Each role has its own dashboard, demo credentials prefilled.</p>
          <ul>
            <li><b>Member</b> — track progress, sessions, payments.</li>
            <li><b>Staff</b> — front desk, point of sale, day-to-day ops.</li>
            <li><b>Trainer</b> — assigned sessions and availability.</li>
            <li><b>Admin</b> — full access to members, plans, reports, promotions.</li>
          </ul>
        </motion.div>

        <motion.div
          className="auth-card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: dur.slow, ease: ease.out }}
        >
          {/* Role selector — 4 roles (Member / Staff / Trainer / Admin) */}
          <div className="role-grid" style={{marginBottom:18}}>
            {['member','staff','trainer','admin'].map(r=>(
              <div
                key={r}
                className={"role-pick"+(role===r?' active':'')}
                onClick={()=>pickRole(r)}
                style={{cursor:'pointer'}}
              >{ROLE_CREDS[r].label}</div>
            ))}
          </div>

          <h2 style={{fontSize:20, textTransform:'uppercase', marginBottom:4}}>
            {role === 'member' && memberTab === 'register' ? 'Create Account' : `${creds.label} Sign In`}
          </h2>
          <p style={{color:'var(--steel)', fontSize:13, margin:'4px 0 14px'}}>
            {role === 'member'
              ? (memberTab === 'login' ? 'Access your member dashboard' : 'Join VinAthletics Gym today')
              : `Sign in to the ${creds.label} dashboard.`}
          </p>

          {role === 'member' && (
            <div className="auth-tabs" style={{marginTop:0}}>
              <button type="button" className={memberTab==='login'?'active':''} onClick={()=>setMemberTab('login')}>Login</button>
              <button type="button" className={memberTab==='register'?'active':''} onClick={()=>setMemberTab('register')}>Register</button>
            </div>
          )}

          {role === 'member' && memberTab === 'register' ? (
            <form onSubmit={handleMemberRegister}>
              <Field label="Full Name">
                <input className="form-control" required placeholder="Juan Dela Cruz"
                  value={regName} onChange={e=>setRegName(e.target.value)} />
              </Field>
              <Field label="Email">
                <input className="form-control" type="email" required placeholder="you@example.com"
                  value={regEmail} onChange={e=>setRegEmail(e.target.value)} />
              </Field>
              <Field label="Phone">
                <input className="form-control" required placeholder="+63 9XX XXX XXXX"
                  value={regPhone} onChange={e=>setRegPhone(e.target.value)} />
              </Field>
              <Field label="Password">
                <input className="form-control" type="password" required placeholder="At least 8 characters"
                  value={regPassword} onChange={e=>setRegPassword(e.target.value)} />
              </Field>
              <button type="submit" className="btn btn-signal btn-block">Create Account</button>
            </form>
          ) : (
            <form onSubmit={handleSignIn}>
              <Field label="Email">
                <input
                  className="form-control" type="email" required
                  placeholder="you@example.com"
                  value={email} onChange={e=>setEmail(e.target.value)}
                />
              </Field>
              <Field label="Password">
                <input
                  className="form-control" type="password" required
                  placeholder="••••••••"
                  value={password} onChange={e=>setPassword(e.target.value)}
                />
              </Field>
              <button type="submit" className="btn btn-signal btn-block">
                Sign In to {creds.label} Dashboard
              </button>
              <p style={{fontSize:11.5, color:'var(--steel)', marginTop:12, textAlign:'center'}}>
                {creds.hint}
              </p>
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
    </div>
  );
}
