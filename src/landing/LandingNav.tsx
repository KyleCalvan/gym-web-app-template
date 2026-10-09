// @ts-nocheck
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { dur, ease } from '../motion.tsx';
import { cx, scrollToSection } from './landing-utils.ts';

const NAV_LINKS = [
  // "About Us" points at the contact strip rather than a section of its own —
  // the page has no About section, and this link used to dangle at #about.
  { label: 'About Us',         href: '#contact' },
  { label: 'Promotions',       href: '#promotions' },
  { label: 'Membership Plans', href: '#plans' },
  { label: 'Trainers',         href: '#trainers' },
  { label: 'Contact',          href: '#contact' },
];

// The nav renders its links and actions twice — once inside the mobile drawer,
// once as the inline desktop bar — so each list is written once here and
// rendered in both places. The inline copy carries the id the hamburger's
// aria-controls points at (a duplicate id on both would be worse than none).
function NavLinks({ id, activeSection, onNavigate }) {
  return (
    <div className="landing-nav-links" id={id}>
      {NAV_LINKS.map((l) => {
        const id = l.href.slice(1);
        const isActive = activeSection === id;
        return (
          <a
            // Two links point at #contact (About Us has no section of its own),
            // so the href isn't unique — key on the label instead.
            key={l.label}
            href={l.href}
            className={cx('nav-link', isActive && 'active')}
            aria-current={isActive ? 'location' : undefined}
            onClick={(e) => onNavigate(e, l.href)}
          >{l.label}</a>
        );
      })}
    </div>
  );
}

function NavActions({ onAction }) {
  return (
    <div className="landing-nav-actions">
      <button
        className="btn btn-outline btn-sm"
        onClick={() => onAction('/login?flow=register')}
      >Join Now</button>
      <button
        className="btn btn-signal btn-sm"
        onClick={() => onAction('/login')}
      >Member Login</button>
    </div>
  );
}

function LandingNav({ stuck, activeSection, onNavigate }) {
  const [open, setOpen] = useState<boolean>(false);

  // Navigates to a section and closes the drawer behind it. The drawer's links
  // and the inline bar's share this handler via the sub-components above.
  const handleLink = (e, href) => {
    if (scrollToSection(e, href.slice(1))) setOpen(false);
  };

  const handleAction = (route) => {
    setOpen(false);
    onNavigate && onNavigate(route);
  };

  return (
    <motion.nav
      className={cx('landing-nav', stuck && 'stuck', open && 'mobile-open')}
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
              <NavLinks activeSection={activeSection} onNavigate={handleLink} />
              <NavActions onAction={handleAction} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <NavLinks id="nav-links" activeSection={activeSection} onNavigate={handleLink} />
      <NavActions onAction={handleAction} />

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
