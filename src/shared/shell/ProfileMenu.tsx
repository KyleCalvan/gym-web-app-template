import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, LogOut, Settings as SettingsIcon, UserRound } from 'lucide-react';
import { dur, ease } from '../../motion.tsx';
import { CURRENT, ROLE_LABEL } from '../../data.ts';
import { Avatar } from '../primitives/Avatar.tsx';
import { Modal } from '../primitives/Modal.tsx';
import { Switch } from '../primitives/Switch.tsx';
import type { NotifPrefs, Role, Setter } from '../../types.ts';

export interface ProfileMenuProps {
  role: Role;
  availableRoles: Role[];
  onSwitchRole: (role: Role) => void;
  open: boolean;
  onClose: () => void;
  onProfile: () => void;
  onLogout: () => void;
  user?: { name?: string; role?: string; avatarUrl?: string };
  notifPrefs: NotifPrefs;
  setNotifPrefs: Setter<NotifPrefs>;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  triggerRef?: React.RefObject<HTMLElement> | null;
}

export function ProfileMenu({
  role, availableRoles, onSwitchRole, open, onClose, onProfile, onLogout, user = CURRENT[role],
  notifPrefs, setNotifPrefs, theme, onToggleTheme, triggerRef,
}: ProfileMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [confirmLogout, setConfirmLogout] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const closeMenu = useCallback(() => {
    setSettingsOpen(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      setSettingsOpen(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return; }
      // Arrow keys cycle focus through the menu items (menu widget pattern).
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const el = menuRef.current;
      if (!el) return;
      const items = Array.from(el.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"]'))
        .filter((n) => n.offsetParent !== null);
      if (items.length === 0) return;
      e.preventDefault();
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next = e.key === 'ArrowDown'
        ? items[(i + 1) % items.length]
        : items[(i - 1 + items.length) % items.length];
      next.focus();
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || triggerRef?.current?.contains(target)) return;
      closeMenu();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, closeMenu, triggerRef]);

  const prevOpen = useRef<boolean>(open);
  const skipFocusReturn = useRef<boolean>(false);
  useEffect(() => {
    if (prevOpen.current && !open && !skipFocusReturn.current) triggerRef?.current?.focus();
    prevOpen.current = open;
    if (open) skipFocusReturn.current = false;
  }, [open, triggerRef]);

  const run = (fn: () => void) => () => {
    closeMenu();
    fn();
  };

  // Log Out goes through a confirmation first, so a stray tap can't end a session.
  const requestLogout = () => {
    skipFocusReturn.current = true;
    setConfirmLogout(true);
    closeMenu();
  };

  return (
    <>
    <AnimatePresence>
      {open && (
          <motion.div
            ref={menuRef}
            className="profile-menu"
            role={settingsOpen ? 'region' : 'menu'}
            aria-label={settingsOpen ? 'Settings' : 'Account'}
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: dur.fast, ease: ease.out }}
          >
            <div className="profile-menu-head">
              <Avatar src={user.avatarUrl} name={user.name || 'User'} size={32} />
              <span className="who">
                <b>{user.name || 'User'}</b>
                <span>{role === 'admin' ? ROLE_LABEL.admin : user.role || ROLE_LABEL[role]}</span>
              </span>
            </div>

            {settingsOpen ? (
              <div className="profile-settings">
                <button type="button" className="profile-settings-back" onClick={() => setSettingsOpen(false)}>
                  <ArrowLeft size={15} aria-hidden="true" /> Account menu
                </button>
                <div className="profile-setting-row">
                  <span>Dark Mode</span>
                  <Switch on={theme === 'dark'} onClick={onToggleTheme} ariaLabel="Toggle dark mode" />
                </div>
                <div className="profile-setting-row">
                  <span>Email Notifications</span>
                  <Switch on={notifPrefs.email} onClick={() => setNotifPrefs((previous) => ({ ...previous, email: !previous.email }))} ariaLabel="Toggle email notifications" />
                </div>
                <div className="profile-setting-row">
                  <span>SMS Notifications</span>
                  <Switch on={notifPrefs.sms} onClick={() => setNotifPrefs((previous) => ({ ...previous, sms: !previous.sms }))} ariaLabel="Toggle SMS notifications" />
                </div>
                <div className="profile-setting-row">
                  <span>Session Reminders</span>
                  <Switch on={notifPrefs.reminders} onClick={() => setNotifPrefs((previous) => ({ ...previous, reminders: !previous.reminders }))} ariaLabel="Toggle session reminders" />
                </div>
                <div className="profile-setting-row">
                  <span>Promotions &amp; Offers</span>
                  <Switch on={notifPrefs.promos} onClick={() => setNotifPrefs((previous) => ({ ...previous, promos: !previous.promos }))} ariaLabel="Toggle promotions and offers" />
                </div>
              </div>
            ) : (
              <div className="profile-menu-list">
                {availableRoles.length > 1 && (
                  <div className="profile-role-switch" role="group" aria-label="Switch authorized interface">
                    <span className="profile-role-switch-label">Switch interface</span>
                    {availableRoles.map((availableRole) => (
                      <button
                        key={availableRole}
                        type="button"
                        role="menuitemradio"
                        aria-checked={role === availableRole}
                        className={`profile-menu-item profile-role-option${role === availableRole ? ' selected' : ''}`}
                        onClick={run(() => onSwitchRole(availableRole))}
                      >
                        <span>{ROLE_LABEL[availableRole]}</span>
                        {role === availableRole && <span className="profile-role-current">Current</span>}
                      </button>
                    ))}
                  </div>
                )}
                <button type="button" role="menuitem" className="profile-menu-item" onClick={run(onProfile)}>
                  <UserRound className="ic" size={18} aria-hidden="true" /> My Profile
                </button>
                <button type="button" role="menuitem" className="profile-menu-item" onClick={() => setSettingsOpen(true)}>
                  <SettingsIcon className="ic" size={18} aria-hidden="true" /> Settings
                </button>
                <button type="button" role="menuitem" className="profile-menu-item danger" onClick={requestLogout}>
                  <LogOut className="ic" size={18} aria-hidden="true" /> Log Out
                </button>
              </div>
            )}
          </motion.div>
      )}
    </AnimatePresence>

    {confirmLogout && (
      <Modal title="Confirm Log Out" showCloseButton={false} onClose={() => setConfirmLogout(false)}>
        <div style={{ padding: '0 24px 24px' }}>
          <p style={{ margin: '0 0 18px', color: 'var(--steel)', fontSize: 15.4, lineHeight: 1.5 }}>
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
