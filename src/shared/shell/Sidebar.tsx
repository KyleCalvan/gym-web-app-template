import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { dur, ease, stagger } from '../../motion.tsx';
import { CURRENT, ROLE_LABEL } from '../../data.ts';
import type { NavSection, Role } from '../../types.ts';
import { Avatar } from '../primitives/Avatar.tsx';

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

  // Close the drawer on Escape / Android hardware back, move focus inside on
  // open, and Tab-trap so focus can't leak behind it.
  const drawerRef = useRef<HTMLDivElement | null>(null);
  // Marks the history entry this drawer pushed, so we only ever pop our own.
  const backMarker = useRef(false);
  useEffect(() => {
    if (!isOpen) return;
    const el = drawerRef.current;
    if (!el) return;

    const focusables = () =>
      Array.from(
        el.querySelectorAll<HTMLElement>('button, a[href], input, [tabindex]:not([tabindex="-1"])')
      // offsetParent is null for position:fixed subtrees in some engines; rects
      // are a reliable "is this actually laid out" check either way.
      ).filter((n) => !(n as HTMLButtonElement).disabled && n.getClientRects().length > 0);

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

    // Keep the page behind the drawer from scrolling while it's open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Android back should close the drawer rather than leave the page: push a
    // placeholder entry we own, then pop it again when the drawer closes.
    if (!backMarker.current) {
      backMarker.current = true;
      window.history.pushState(null, '');
    }
    const onPop = () => { backMarker.current = false; setIsOpen(false); };
    window.addEventListener('popstate', onPop);

    // Crossing to desktop while the drawer is open would leave the page scroll
    // locked, so close it at the breakpoint instead.
    const onResize = () => { if (window.innerWidth > 980) setIsOpen(false); };
    window.addEventListener('resize', onResize);

    window.addEventListener('keydown', onKey);
    el.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('resize', onResize);
      document.body.style.overflow = prevOverflow;
      // Closed by something other than the back button — hand our entry back.
      if (backMarker.current) {
        backMarker.current = false;
        window.history.back();
      }
      // Focus was moved inside the drawer on open; don't strand it on an element
      // that is now visibility:hidden. Send it back to the hamburger.
      if (el.contains(document.activeElement)) {
        (document.querySelector('.nav-toggle-btn') as HTMLButtonElement | null)?.focus();
      }
    };
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

        {/* Who's signed in — mobile only. The desktop sidebar keeps its compact
           brand header; on phones the drawer doubles as the account surface, so
           it leads with the member's details before the role's shortcuts. */}
        <div className="drawer-user">
          <Avatar src={CURRENT[role].avatarUrl} name={CURRENT[role].name} size={36} />
          <span className="who">
            <b>{CURRENT[role].name}</b>
            <span>{ROLE_LABEL[role]}</span>
          </span>
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
