// @ts-nocheck
import { motion } from 'framer-motion';
import { dur, ease } from '../motion.tsx';

function LandingNav({ stuck, activeSection, onNavigate }) {
  const navLinks = [
    { label: 'Promotions',       href: '#promotions' },
    { label: 'Membership Plans', href: '#plans' },
    { label: 'Trainers',         href: '#trainers' },
    { label: 'Contact',          href: '#contact' },
  ];
  return (
    <motion.nav
      className={"landing-nav" + (stuck ? " stuck" : "")}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: dur.base, ease: ease.out }}
    >
      <div className="brand"><span className="brand-mark">🏋</span> VinAthletics</div>
      <div className="landing-nav-links">
        {navLinks.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className={"nav-link" + (activeSection === l.href.slice(1) ? " active" : "")}
            onClick={(e) => {
              const id = l.href.slice(1);
              const el = document.getElementById(id);
              if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
            }}
          >{l.label}</a>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
  );
}

export default LandingNav;