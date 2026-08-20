import { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { dur, ease, stagger, Ticker } from './motion.jsx';

export default function Landing({ onLogin, members, setMembers, toast }){
  const [authTab, setAuthTab] = useState('login');
  const [role, setRole] = useState('member');

  // Login form
  const [email, setEmail] = useState('member@vinathletics.gym');
  const [password, setPassword] = useState('password');
  // Register form
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // Membership card mouse parallax (±8 y / ±4 x).
  const heroRef = useRef(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const cardX = useTransform(mx, (v) => v * 4);
  const cardY = useTransform(my, (v) => v * 8);
  const onHeroMove = (e) => {
    const r = heroRef.current?.getBoundingClientRect();
    if (!r) return;
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    mx.set(nx);
    my.set(ny);
  };
  const onHeroLeave = () => { mx.set(0); my.set(0); };

  const heroItem = (i) => ({
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.08 + i * stagger.tile, duration: dur.base, ease: ease.out },
  });

  const handleLogin = (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) { toast('Please enter a valid email'); return; }
    if (password.length < 6) { toast('Password must be at least 6 characters'); return; }
    onLogin(role);
  };

  const handleRegister = (e) => {
    e.preventDefault();
    if (!regName.trim()) { toast('Name is required'); return; }
    if (!/^\S+@\S+\.\S+$/.test(regEmail)) { toast('Please enter a valid email'); return; }
    if (regPassword.length < 8) { toast('Password must be at least 8 characters'); return; }
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
    toast('Welcome, ' + regName.trim() + '! Your member ID is ' + id);
    onLogin('member', id);
  };

  return (
    <div className="landing">
      <motion.nav
        className="landing-nav"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: dur.base, ease: ease.out }}
      >
        <div className="brand"><span className="brand-mark">🏋</span> VinAthletics</div>
        <a href="#login-section" className="btn btn-signal btn-sm">Member Login</a>
      </motion.nav>

      <div
        className="landing-hero"
        ref={heroRef}
        onMouseMove={onHeroMove}
        onMouseLeave={onHeroLeave}
      >
        <div>
          <motion.div className="eyebrow" style={{marginBottom:14}} {...heroItem(0)}>
            Gym Management, Squared Away
          </motion.div>
          <motion.h1 {...heroItem(1)}>
            Run your gym like a{' '}
            <span className="accent-word">
              champion&nbsp;runs
              <motion.span
                className="vm-underline"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.5, delay: 0.3, ease: ease.out }}
                style={{ transformOrigin: 'left center' }}
              />
            </span>{' '}
            a season.
          </motion.h1>
          <motion.p className="lede" {...heroItem(2)}>
            Memberships, coaching schedules, point-of-sale and reporting — one ledger for admins, staff, trainers and members alike.
          </motion.p>
          <motion.div className="btn-group" style={{display:'flex', gap:12}} {...heroItem(3)}>
            <a href="#login-section" className="btn btn-signal">Get Started</a>
            <a href="#promotions" className="btn btn-outline">View Promotions</a>
          </motion.div>
          <div className="stat-row">
            <motion.div {...heroItem(4)}>
              <div className="n"><Ticker to={668} /></div>
              <div className="l">Active Members</div>
            </motion.div>
            <motion.div {...heroItem(5)}>
              <div className="n"><Ticker to={4} /></div>
              <div className="l">Certified Trainers</div>
            </motion.div>
            <motion.div {...heroItem(6)}>
              <div className="n"><Ticker to={512} prefix="₱" suffix="k" /></div>
              <div className="l">Revenue / mo</div>
            </motion.div>
          </div>
        </div>
        <motion.div
          className="membership-card"
          style={{ x: cardX, y: cardY }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: dur.slow, delay: 0.15, ease: ease.out }}
        >
          <div className="mc-top">
            <div className="mc-org">VinAthletics Gym</div>
            <div className="mc-chip"></div>
          </div>
          <div className="mc-name">Juan Dela Cruz</div>
          <div className="mc-row">
            <div>Plan<b>Premium</b></div>
            <div>Member ID<b>M-1042</b></div>
            <div>Valid Thru<b>09/2026</b></div>
          </div>
        </motion.div>
      </div>

      <section className="promo-strip" id="promotions">
        <h2>Current Promotions</h2>
        <p className="sub">Take advantage of our limited-time offers</p>
        <div className="promo-grid">
          {[
            {tag:'20% OFF', title:'New Member Special', body:'Sign up today and get 20% off your first 3 months, plus a free fitness assessment.', valid:'Dec 31, 2026'},
            {tag:'BUY 1 GET 1', title:'Personal Training', body:'Book 10 personal training sessions and get 5 more free with certified trainers.', valid:'Nov 30, 2026'},
            {tag:'30% OFF', title:'Bring a Friend', body:'Refer a friend — both of you enjoy 30% off annual memberships.', valid:'Oct 15, 2026'},
            {tag:'15% OFF', title:'Early Bird Membership', body:'Join the morning crew for special off-peak rates and full equipment access.', valid:'Jan 31, 2027'},
          ].map((p,i)=>(
            <motion.div
              className="promo-card"
              key={i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: dur.base, delay: i * stagger.list, ease: ease.out }}
              whileHover={{ y: -2, boxShadow: '6px 6px 0 rgba(22,36,31,0.18)' }}
            >
              <span className="tag">{p.tag}</span>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
              <div className="valid">VALID UNTIL {p.valid.toUpperCase()}</div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="feature-strip">
        {[
          {n:'01', t:'Easy Payments', d:'Multiple payment options, receipts and history tracking.'},
          {n:'02', t:'Smart Scheduling', d:'Book coaching sessions and manage trainer availability.'},
          {n:'03', t:'Reports & Analytics', d:'Track revenue, members and performance in real time.'},
          {n:'04', t:'Notifications', d:'Stay updated on bookings, payments and announcements.'},
        ].map((f,i)=>(
          <motion.div
            className="feature"
            key={i}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: dur.base, delay: i * stagger.list, ease: ease.out }}
            whileHover={{ y: -2 }}
          >
            <div className="num">{f.n}</div>
            <h4>{f.t}</h4>
            <p>{f.d}</p>
          </motion.div>
        ))}
      </section>

      <section className="auth-wrap-dark" id="login-section">
        <div className="auth-wrap">
          <motion.div
            className="side-note"
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: dur.slow, ease: ease.out }}
          >
            <div className="eyebrow" style={{color:'#7E9186'}}>Sign in</div>
            <h2>Welcome back to the floor.</h2>
            <p>Pick your role and sign in to reach your dashboard — admins oversee the gym, staff run the front desk, trainers manage sessions, and members track their own progress.</p>
          </motion.div>
          <motion.div
            className="auth-card"
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: dur.slow, ease: ease.out }}
          >
            <h2 style={{fontSize:20, textTransform:'uppercase'}}>{authTab==='login' ? 'Sign In' : 'Create Account'}</h2>
            <p style={{color:'var(--steel)', fontSize:13, margin:'4px 0 0'}}>
              {authTab==='login' ? 'Access your dashboard' : 'Join VinAthletics Gym today'}
            </p>
            <div className="auth-tabs">
              <button className={authTab==='login'?'active':''} onClick={()=>setAuthTab('login')}>Login</button>
              <button className={authTab==='register'?'active':''} onClick={()=>setAuthTab('register')}>Register</button>
            </div>

            {authTab==='login' ? (
              <form onSubmit={handleLogin}>
                <div className="form-group">
                  <label>Login As</label>
                  <div className="role-grid">
                    {['admin','staff','trainer','member'].map(r=>(
                      <div key={r} className={"role-pick"+(role===r?' active':'')} onClick={()=>setRole(r)} style={{cursor:'pointer'}}>
                        {r}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input className="form-control" type="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input className="form-control" type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} required />
                </div>
                <button type="submit" className="btn btn-signal btn-block">Sign In as {role[0].toUpperCase()+role.slice(1)}</button>
              </form>
            ) : (
              <form onSubmit={handleRegister}>
                <div className="form-group"><label>Full Name</label><input className="form-control" placeholder="Juan Dela Cruz" value={regName} onChange={e=>setRegName(e.target.value)} required/></div>
                <div className="form-group"><label>Email</label><input className="form-control" type="email" placeholder="you@example.com" value={regEmail} onChange={e=>setRegEmail(e.target.value)} required/></div>
                <div className="form-group"><label>Phone</label><input className="form-control" placeholder="+63 9XX XXX XXXX" value={regPhone} onChange={e=>setRegPhone(e.target.value)} required/></div>
                <div className="form-group"><label>Password</label><input className="form-control" type="password" placeholder="At least 8 characters" value={regPassword} onChange={e=>setRegPassword(e.target.value)} required/></div>
                <button type="submit" className="btn btn-signal btn-block">Create Account</button>
              </form>
            )}
          </motion.div>
        </div>
      </section>

      <footer className="site-footer">© 2026 VinAthletics Gym Management System. All rights reserved.</footer>
    </div>
  );
}
