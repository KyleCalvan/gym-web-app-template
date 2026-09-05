import { useState, useMemo } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import './sidebar.css';
import { dur, ease, stagger } from '../../motion.tsx';
import { Modal } from '../primitives/Modal.tsx';
import { SidebarSearch } from './SidebarSearch.tsx';
import type { Bell, NavSection, Role } from '../../types.ts';

export interface SidebarProps {
  role: Role;
  brand: string;
  nav: NavSection[];
  active: string;
  onNav: (id: string) => void;
  onLogout: () => void;
  onSwitchRole?: (r: Role) => void;
  searchable?: boolean;
  bell?: Bell | null;
}

export default function Sidebar({
  role, brand, nav, active, onNav, onLogout, searchable, bell, isOpen, setIsOpen,
}: SidebarProps & { isOpen: boolean; setIsOpen: (open: boolean) => void }) {
  const [query, setQuery] = useState<string>('');
  const [filters, setFilters] = useState<string[]>([]);
  const [confirmLogout, setConfirmLogout] = useState<boolean>(false);
  const bellControls = useAnimationControls();

  const sectionNames = useMemo<string[]>(() => nav.map((s) => s.section), [nav]);

  const visibleNav = useMemo<NavSection[]>(() => {
    return nav
      .filter((sec) => filters.length === 0 || filters.includes(sec.section))
      .map((sec) => ({
        ...sec,
        items: sec.items.filter((it) => it.label.toLowerCase().includes(query.toLowerCase())),
      }))
      .filter((sec) => sec.items.length > 0);
  }, [nav, query, filters]);

  const hasProfileInNav = useMemo(() => {
    return nav.some(sec => sec.items.some(item => item.id === 'profile'));
  }, [nav]);

  const wiggle = () => {
    bellControls.start({
      rotate: [0, -14, 14, -10, 10, -6, 6, 0],
      transition: { duration: 0.55, ease: ease.out },
    });
    if (bell && bell.onClick) bell.onClick();
  };

  return (
    <>
      <div className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px 18px', borderBottom: '1px solid #2C4038', marginBottom: 14 }}>
          <div className="brand" style={{ padding: 0, border: 'none', margin: 0, color: 'var(--paper)' }}>
            <img src="/logo.jpg" alt="VinAthletics" className="brand-mark-img" /> {brand}
          </div>
          {bell && (
            <motion.button
              className="bell-btn"
              aria-label="Notifications"
              onClick={wiggle}
              animate={bellControls}
              whileTap={{ scale: 0.92 }}
              style={{ marginRight: 0 }}
            >
              🔔
              {bell.count > 0 && (
                <motion.span
                  className="bell-dot"
                  animate={{ scale: [1, 1.25, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
            </motion.button>
          )}
          <button className="nav-close-btn" onClick={() => setIsOpen(false)} style={{ display: 'none' }}>✕</button>
        </div>

        {searchable && (
          <SidebarSearch
            sections={sectionNames}
            onQueryChange={setQuery}
            onFiltersChange={setFilters}
          />
        )}

        {visibleNav.length === 0 && searchable && (
          <div className="ss-empty" style={{ padding: '0 20px' }}>No matching pages.</div>
        )}

        {visibleNav.map((sec) => (
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

        {!hasProfileInNav && (
          <div className="nav-section">
            <div className="head">Other</div>
            <button className="nav-item" onClick={() => onNav('profile')}><span className="ic">👤</span>Profile</button>
          </div>
        )}

        <div className="nav-section">
          <div className="head">Session</div>
          <button className="nav-item" onClick={() => setConfirmLogout(true)}><span className="ic">←</span>Log Out</button>
        </div>
      </div>
      {isOpen && (
        <div className="sidebar-backdrop" onClick={() => setIsOpen(false)} />
      )}
      {confirmLogout && (
        <Modal title="Confirm Log Out" showCloseButton={false} onClose={() => setConfirmLogout(false)}>
          <div style={{ padding: '0 24px 24px' }}>
            <p style={{ margin: '0 0 18px', color: 'var(--steel)', fontSize: 14, lineHeight: 1.5 }}>
              Are you sure you want to log out? You'll need to sign in again to access your account.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" type="button" onClick={() => setConfirmLogout(false)}>Cancel</button>
              <button className="btn btn-signal" type="button" onClick={() => { setConfirmLogout(false); onLogout(); }}>Log Out</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
