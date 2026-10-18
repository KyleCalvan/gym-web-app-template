import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Bell, CheckCheck, X } from 'lucide-react';
import type { Notification, Setter } from '../../types.ts';
import { dur, ease } from '../../motion.tsx';

interface NotificationsDropdownProps {
  open: boolean;
  onClose: () => void;
  onToggle: () => void;
  notifications: Notification[];
  setNotifications: Setter<Notification[]>;
  onNav: (view: string) => void;
  toast: (message: string) => void;
}

function formatNotificationTime(value: string): string {
  const date = new Date(value);
  if (value && !Number.isNaN(date.getTime()) && /[-T:]/.test(value)) {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }
  return value || 'Time unavailable';
}

export default function NotificationsDropdown({
  open,
  onClose,
  onToggle,
  notifications,
  setNotifications,
  onNav,
  toast,
}: NotificationsDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const unreadCount = notifications.filter((notification) => notification.unread).length;

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (dropdownRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  const markRead = (id: number) => {
    setNotifications((previous) => previous.map((notification) => (
      notification.id === id ? { ...notification, unread: false } : notification
    )));
  };

  const markAllRead = () => {
    if (unreadCount === 0) return;
    setNotifications((previous) => previous.map((notification) => ({ ...notification, unread: false })));
    toast('All notifications marked as read');
  };

  const openNotification = (notification: Notification) => {
    if (notification.unread) markRead(notification.id);
    onClose();
    if (notification.actionView) {
      onNav(notification.actionView);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="bell-btn"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={onToggle}
      >
        <Bell size={19} aria-hidden="true" />
        {unreadCount > 0 && <span className="notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={dropdownRef}
            className="notification-dropdown"
            role="dialog"
            aria-label="Notifications"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: dur.fast, ease: ease.out }}
          >
            <div className="notification-dropdown-head">
              <div>
                <h2>Notifications</h2>
                <span>{unreadCount ? `${unreadCount} unread` : 'You’re all caught up'}</span>
              </div>
              <div className="notification-dropdown-head-actions">
                {unreadCount > 0 && (
                  <button type="button" className="notification-mark-all" onClick={markAllRead}>
                    <CheckCheck size={15} aria-hidden="true" /> Mark all read
                  </button>
                )}
                <button type="button" className="notification-close" aria-label="Close notifications" onClick={onClose}>
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
            </div>
            {notifications.length === 0 ? (
              <div className="notification-empty">
                <Bell size={22} aria-hidden="true" />
                <span>No notifications yet.</span>
              </div>
            ) : (
              <ul className="notification-list">
                {notifications.map((notification) => (
                  <li key={notification.id} className={`notification-item${notification.unread ? ' is-unread' : ''}`}>
                    <button
                      type="button"
                      className="notification-item-main"
                      onClick={() => openNotification(notification)}
                    >
                      <span className="notification-status-dot" aria-hidden="true" />
                      <span className="notification-copy">
                        <strong>{notification.title}</strong>
                        <span>{notification.body}</span>
                        <time>{formatNotificationTime(notification.time)}</time>
                        <span className="notification-read-state">{notification.unread ? 'Unread' : 'Read'}</span>
                      </span>
                    </button>
                    {notification.actionView && (
                      <button
                        type="button"
                        className="notification-action"
                        onClick={() => openNotification(notification)}
                      >
                        {notification.actionLabel || 'View'} <ArrowRight size={14} aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
