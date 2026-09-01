// @ts-nocheck
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { dur, ease } from '../motion.tsx';

function LandingNav({ stuck, activeSection, onNavigate }) {
  const [open, setOpen] = useState<boolean>(false);
  const navLinks = [
    { label: 'Promotions',       href: '#promotions' },
    { label: 'Membership Plans', href: '#plans' },
    { label: 'Trainers',         href: '#trainers' },
    { label: 'Contact',          href: '#contact' },
  ];

  const handleLink = (e, href) => {
    const id = href.slice(1);
    const el = document.getElementById(id);
    if (el) {
      e.preventDefault();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setOpen(false);
    }
  };

  return (
    <motion.nav
      className={
        "landing-nav" +
        (stuck ? " stuck" : "") +
        (open ? " mobile-open" : "")
      }
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: dur.base, ease: ease.out }}
    >
      <div className="brand">
        <img src="/logo.jpg" alt="VinAthletics" className="brand-mark-img" />
        <span>VinAthletics</span>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0, transition: { duration: dur.fast, ease: ease.out } }}
            exit={{ opacity: 0, y: -6, transition: { duration: dur.fast, ease: ease.out } }}
            className="mobile-menu-overlay"
          >
            <div className="mobile-menu-content">
              <div className="landing-nav-links">
                {navLinks.map((l) => {
                  const id = l.href.slice(1);
                  const isActive = activeSection === id;
                  return (
                    <a
                      key={l.href}
                      href={l.href}
                      className={"nav-link" + (isActive ? " active" : "")}
                      aria-current={isActive ? 'location' : undefined}
                      onClick={(e) => handleLink(e, l.href)}
                    >{l.label}</a>
                  );
                })}
              </div>
              <div className="landing-nav-actions">
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => { setOpen(false); onNavigate && onNavigate('/login?flow=register'); }}
                >Join Now</button>
                <button
                  className="btn btn-signal btn-sm"
                  onClick={() => { setOpen(false); onNavigate && onNavigate('/login'); }}
                >Member Login</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="landing-nav-links">
        {navLinks.map((l) => {
          const id = l.href.slice(1);
          const isActive = activeSection === id;
          return (
            <a
              key={l.href}
              href={l.href}
              className={"nav-link" + (isActive ? " active" : "")}
              aria-current={isActive ? 'location' : undefined}
              onClick={(e) => handleLink(e, l.href)}
            >{l.label}</a>
          );
        })}
      </div>

      <div className="landing-nav-actions">
        <button
          className="btn btn-outline btn-sm"
          onClick={() => { setOpen(false); onNavigate && onNavigate('/login?flow=register'); }}
        >Join Now</button>
        <button
          className="btn btn-signal btn-sm"
          onClick={() => { setOpen(false); onNavigate && onNavigate('/login'); }}
        >Member Login</button>
      </div>

      <button
        type="button"
        className="nav-toggle"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls="nav-links"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X size={22} strokeWidth={2} /> : <Menu size={22} strokeWidth={2} />}
      </button>
    </motion.nav>
  );
}

export default LandingNav;
