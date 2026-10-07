import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { dur, ease, stagger } from '../../motion.tsx';
import type { NavSection, Role } from '../../types.ts';

export interface SidebarProps {
  role: Role;
  brand: string;
  nav: NavSection[];
  active: string;
  onNav: (id: string) => void;
}

export default function Sidebar({
  role, brand, nav, active, onNav, isOpen, setIsOpen,
}: SidebarProps & { isOpen: boolean; setIsOpen: (open: boolean) => void }) {
  // Page search moved to the top header (GlobalSearch), so the sidebar is now
  // a plain, unfiltered nav list.

  // Close the drawer on Escape (matches the Android back-button expectation),
  // move focus inside on open, and Tab-trap so focus can't leak behind it.
  const drawerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!isOpen) return;
    const el = drawerRef.current;
    if (!el) return;

    const focusables = () =>
      Array.from(
        el.querySelectorAll<HTMLElement>('button, a[href], input, [tabindex]:not([tabindex="-1"])')
      ).filter((n) => !(n as HTMLButtonElement).disabled && n.offsetParent !== null);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setIsOpen(false); return; }
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };

    window.addEventListener('keydown', onKey);
    el.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, setIsOpen]);

  return (
    <>
      <div
        className={`sidebar ${isOpen ? 'open' : ''}`}
        ref={drawerRef}
        tabIndex={-1}
        role={isOpen ? 'dialog' : undefined}
        aria-modal={isOpen || undefined}
        aria-label="Navigation"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px 18px', borderBottom: '1px solid var(--line)', marginBottom: 14 }}>
          <div className="brand" style={{ padding: 0, border: 'none', margin: 0, color: 'var(--ink)' }}>
            <img src="/logo.jpg" alt="VinAthletics" className="brand-mark-img" /> {brand}
          </div>
          <button className="nav-close-btn" onClick={() => setIsOpen(false)} style={{ display: 'none' }}>✕</button>
        </div>

        {nav.map((sec) => (
          <div className="nav-section" key={sec.section}>
            <div className="head">{sec.section}</div>
            {sec.items.map((it, i) => (
              <motion.button
                key={it.id}
                className={"nav-item" + (active === it.id ? " active" : "")}
                onClick={() => onNav(it.id)}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: dur.base, delay: i * stagger.list, ease: ease.out }}
                whileHover={{ x: 2 }}
              >
                <span className="ic">{it.ic}</span>{it.label}
              </motion.button>
            ))}
          </div>
        ))}
      </div>
      {isOpen && (
        <div className="sidebar-backdrop" onClick={() => setIsOpen(false)} />
      )}
    </>
  );
}
