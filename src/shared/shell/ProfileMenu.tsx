import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { dur, ease } from '../../motion.tsx';
import { CURRENT, ROLE_LABEL } from '../../data.ts';
import { Avatar } from '../primitives/Avatar.tsx';
import { Modal } from '../primitives/Modal.tsx';
import type { Role } from '../../types.ts';

export interface ProfileMenuProps {
  role: Role;
  open: boolean;
  onClose: () => void;
  onProfile: () => void;
  onLogout: () => void;
  triggerRef?: React.RefObject<HTMLElement> | null;
}

export function ProfileMenu({ role, open, onClose, onProfile, onLogout, triggerRef }: ProfileMenuProps) {
  const user = CURRENT[role];
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [confirmLogout, setConfirmLogout] = useState<boolean>(false);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      // Arrow keys cycle focus through the menu items (menu widget pattern).
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const el = menuRef.current;
      if (!el) return;
      const items = Array.from(el.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        .filter((n) => n.offsetParent !== null);
      if (items.length === 0) return;
      e.preventDefault();
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next = e.key === 'ArrowDown'
        ? items[(i + 1) % items.length]
        : items[(i - 1 + items.length) % items.length];
      next.focus();
    };
    window.addEventListener('keydown', onKey);
    // Land focus on the first item on open, per the menu widget pattern.
    const first = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
    first?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Return focus to the pill when the menu closes. The guard stops it from
  // stealing focus when we're closing only to open the log-out confirmation.
  const prevOpen = useRef<boolean>(open);
  const skipFocusReturn = useRef<boolean>(false);
  useEffect(() => {
    if (prevOpen.current && !open && !skipFocusReturn.current) triggerRef?.current?.focus();
    prevOpen.current = open;
    if (open) skipFocusReturn.current = false;
  }, [open, triggerRef]);

  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };

  // Log Out goes through a confirmation first, so a stray tap can't end a session.
  const requestLogout = () => {
    skipFocusReturn.current = true;
    setConfirmLogout(true);
    onClose();
  };

  return (
    <>
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="profile-menu-scrim"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: dur.fast, ease: ease.out }}
          />
          <motion.div
            ref={menuRef}
            className="profile-menu"
            role="menu"
            aria-label="Account"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: dur.fast, ease: ease.out }}
          >
            <div className="profile-menu-head">
              <Avatar src={user.avatarUrl} name={user.name} size={32} />
              <span className="who">
                <b>{user.name}</b>
                <span>{ROLE_LABEL[role]}</span>
              </span>
            </div>

            <div className="profile-menu-list">
              <button
                type="button"
                role="menuitem"
                className="profile-menu-item"
                onClick={run(onProfile)}
              >
                <span className="ic" aria-hidden="true">👤</span> My Profile
              </button>

              <button
                type="button"
                role="menuitem"
                className="profile-menu-item danger"
                onClick={requestLogout}
              >
                <span className="ic" aria-hidden="true">←</span> Log Out
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>

    {confirmLogout && (
      <Modal title="Confirm Log Out" showCloseButton={false} onClose={() => setConfirmLogout(false)}>
        <div style={{ padding: '0 24px 24px' }}>
          <p style={{ margin: '0 0 18px', color: 'var(--steel)', fontSize: 14, lineHeight: 1.5 }}>
            Are you sure you want to log out? You'll need to sign in again to access your account.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-outline" type="button" onClick={() => setConfirmLogout(false)}>Cancel</button>
            <button className="btn btn-danger" type="button" onClick={() => { setConfirmLogout(false); onLogout(); }}>Log Out</button>
          </div>
        </div>
      </Modal>
    )}
    </>
  );
}
