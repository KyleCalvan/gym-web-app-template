import { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { dur, ease, stagger } from './motion.jsx';

export default function Landing({ onLogin, plans, promotions, trainers, onNavigate }){
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

  const whyTiles = [
    {ic:'📋', title:'All-in-One Management',     body:'Handle memberships, billing, attendance, and reporting in one seamless system.'},
    {ic:'📅', title:'Smarter Schedules & Coaching', body:'Easily manage classes, sessions, and trainer availability.'},
    {ic:'📊', title:'Real-Time Reporting',       body:'Track performance, member engagement, and business growth in real time.'},
    {ic:'🏦', title:'Secure & Reliable',         body:'Your data is safe with us, so you can focus on what matters most.'},
  ];

  const navLinks = [
    {label:'Promotions',       href:'#promotions'},
    {label:'Membership Plans', href:'#plans'},
    {label:'Trainers',         href:'#trainers'},
    {label:'Contact',          href:'#contact'},
  ];

  // Section refs for scroll-spy
  const refs = {
    promotions: useRef(null),
    plans:      useRef(null),
    trainers:   useRef(null),
    contact:    useRef(null),
  };
  const [activeSection, setActiveSection] = useState(null);
  const [stuck, setStuck] = useState(false);

  useEffect(()=>{
    const onScroll = ()=> setStuck(window.scrollY > 60);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(()=>{
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) setActiveSection(e.target.id); }),
      { rootMargin: '-30% 0px -50% 0px', threshold: 0 }
    );
    Object.values(refs).forEach(r => r.current && obs.observe(r.current));
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activePromos = (promotions || []).filter(p => p.status === 'Published').slice(0, 4);
  const activePlans  = (plans || []).filter(p => p.status !== 'Inactive');
  const activeTrainers = (trainers || []).filter(t => t.status !== 'On Leave');

  return (
    <div className="landing">
      <motion.nav
        className={"landing-nav" + (stuck ? " stuck" : "")}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: dur.base, ease: ease.out }}
      >
        <div className="brand"><span className="brand-mark">🏋</span> VinAthletics</div>
        <div className="landing-nav-links">
          {navLinks.map(l => (
            <a
              key={l.href}
              href={l.href}
              className={"nav-link" + (activeSection === l.href.slice(1) ? " active" : "")}
              onClick={(e)=>{
                // Smooth scroll handled by CSS; this just ensures the section id exists
                const id = l.href.slice(1);
                const el = document.getElementById(id);
                if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
              }}
            >{l.label}</a>
          ))}
        </div>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => onNavigate && onNavigate('/login?flow=register')}
          >Join Now</button>
          <button
            className="btn btn-signal btn-sm"
            onClick={() => onNavigate && onNavigate('/login')}
          >Member Login</button>
        </div>
      </motion.nav>

      <div
        className="landing-hero"
        ref={heroRef}
        onMouseMove={onHeroMove}
        onMouseLeave={onHeroLeave}
      >
        <div className="hero-blob hero-blob-1" />
        <div className="hero-blob hero-blob-2" />
        <div className="landing-hero-inner">
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
              <button
                className="btn btn-signal"
                onClick={() => onNavigate && onNavigate('/login')}
              >Get Started</button>
              <a
                href="#promotions"
                className="btn btn-outline"
                onClick={(e)=>{
                  const el = document.getElementById('promotions');
                  if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
                }}
              >View Promotions</a>
            </motion.div>
            <motion.div className="hero-stats" {...heroItem(4)}>
              <span className="stat"><span className="dot" /> 1,200+ Active Members</span>
              <span className="stat"><span className="dot" /> 50+ Classes Weekly</span>
              <span className="stat"><span className="dot" /> 4.8★ Avg Rating</span>
            </motion.div>
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
      </div>

      <section className="hero-cards-row">
        <div className="hero-cards-row-inner">
          <h2>Why Members Pick VinAthletics</h2>
          <p className="sub">Everything you need under one roof — from world-class equipment to certified coaches.</p>
          <div className="hero-cards-grid">
            {whyTiles.map((c,i)=>(
              <motion.div
                className="hero-card"
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: dur.base, delay: i * stagger.list, ease: ease.out }}
              >
                <div className="ic">{c.ic}</div>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </motion.div>
            ))}
          </div>
          <div style={{textAlign:'center', marginTop:36}}>
            <button className="btn btn-outline btn-sm">Learn More</button>
          </div>
        </div>
      </section>

      <section className="promo-strip" id="promotions" ref={refs.promotions}>
        <div className="promo-strip-inner">
          <h2>Current Promotions</h2>
          <p className="sub">Take advantage of our limited-time offers</p>
          <div className="promo-grid">
            {activePromos.map((p,i)=>(
              <motion.div
                className="promo-card"
                key={p.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: dur.base, delay: i * stagger.list, ease: ease.out }}
                whileHover={{ y: -2, boxShadow: '6px 6px 0 rgba(22,36,31,0.18)' }}
              >
                <span className="tag">
                  {p.discountType === 'Percentage' ? (p.discount + ' OFF') :
                   p.discountType === 'Bundle'     ? 'BUNDLE DEAL' :
                   p.discountType === 'Fixed'      ? ('₱' + p.discount + ' OFF') :
                   (p.discountType ? p.discountType.toUpperCase() : 'SPECIAL')}
                </span>
                <h3>{p.title}</h3>
                <p>{p.code ? 'Use code ' + p.code + ' at checkout.' : 'Limited time offer.'}</p>
                <div className="valid">VALID UNTIL {p.validUntil.toUpperCase()}</div>
              </motion.div>
            ))}
            {activePromos.length === 0 && (
              <div className="empty-state">No active promotions right now.</div>
            )}
          </div>
        </div>
      </section>

      <section className="plans-strip" id="plans" ref={refs.plans}>
        <div className="plans-strip-inner">
          <h2>Membership Plans</h2>
          <p className="sub">Pick a plan that fits your goals — switch or cancel anytime.</p>
          <div className="grid grid-3">
            {activePlans.map(p=>(
              <div className={"plan-card"+(p.featured?' featured':'')} key={p.name}>
                {p.featured && <span className="ribbon">Most Popular</span>}
                <h3 style={{fontSize:18}}>{p.name}</h3>
                <div className="price">₱{p.price.toLocaleString('en-PH')}<span>/{p.period}</span></div>
                <ul>{p.perks.map((perk,i)=><li key={i}>✓ {perk}</li>)}</ul>
                <button
                  className={"btn btn-sm btn-block "+(p.featured?'btn-signal':'btn-outline')}
                  onClick={() => onNavigate && onNavigate('/login')}
                >Choose {p.name}</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="trainers-strip" id="trainers" ref={refs.trainers}>
        <div className="trainers-strip-inner">
          <h2>Meet Our Trainers</h2>
          <p className="sub">Certified coaches who specialize in strength, mobility, and conditioning.</p>
          <div className="trainers-grid">
            {activeTrainers.map(t=>(
              <motion.div
                className="trainer-card"
                key={t.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: dur.base, ease: ease.out }}
              >
                <div className="avatar">{t.name.split(' ').map(w=>w[0]).slice(0,2).join('')}</div>
                <div className="spec">{t.specialty}</div>
                <h3>{t.name}</h3>
                <div className="meta">
                  <div className="row"><span>Certifications</span><b>{t.certs}</b></div>
                  <div className="row"><span>Rating</span><b className="mono">★ {t.rating}</b></div>
                </div>
                <button
                  className="btn btn-outline btn-sm"
                  style={{marginTop:10}}
                  onClick={() => onNavigate && onNavigate('/login')}
                >Book a Session</button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="contact-strip" id="contact" ref={refs.contact}>
        <div className="contact-strip-inner">
          <h2>Visit or Get in Touch</h2>
          <p className="sub">Drop by, call, or message us — we're happy to help you start.</p>
          <div className="contact-grid">
            <div className="contact-card">
              <div className="ic">📍</div>
              <div className="label">Location</div>
              <div className="value">123 Bonifacio St., Makati</div>
            </div>
            <div className="contact-card">
              <div className="ic">�</div>
              <div className="label">Phone</div>
              <div className="value">+63 917 555 0142</div>
            </div>
            <div className="contact-card">
              <div className="ic">✉️</div>
              <div className="label">Email</div>
              <div className="value">hello@vinathletics.gym</div>
            </div>
            <div className="contact-card">
              <div className="ic">⏰</div>
              <div className="label">Hours</div>
              <div className="value">Mon–Sun · 5AM – 11PM</div>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-band">
        <h2>BUILT FOR GYMS. DESIGNED FOR <span className="accent-word">CHAMPIONS.</span></h2>
      </section>

      <footer className="site-footer">© 2026 VinAthletics Gym Management System. All rights reserved.</footer>
    </div>
  );
}
