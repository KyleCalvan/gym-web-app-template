// @ts-nocheck
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Modal, Switch } from '../shared';
import { dur, ease, stagger } from '../motion.tsx';
import type { Notification, NotifPrefs, Setter } from '../../types.ts';

type Theme = 'dark' | 'light';

function NotificationsModal({
  onClose,
  notifications,
  setNotifications,
  notifPrefs,
  setNotifPrefs,
  toast,
  theme,
  onToggleTheme,
}: {
  onClose: () => void;
  notifications: Notification[];
  setNotifications: Setter<Notification[]>;
  notifPrefs: NotifPrefs;
  setNotifPrefs: Setter<NotifPrefs>;
  toast: (msg: string) => void;
  theme: Theme;
  onToggleTheme: () => void;
}){
  const [tab, setTab] = useState('inbox');
  const markRead = (id) => { setNotifications(prev => prev.map(n => n.id===id ? {...n, unread:false} : n)); };
  const markAllRead = () => { setNotifications(prev => prev.map(n => ({...n, unread:false}))); toast('All notifications marked as read'); };
  const toggle = (key) => { setNotifPrefs(p => ({...p, [key]: !p[key]})); };

  const switchTheme = () => {
    onToggleTheme();
    toast(theme === 'dark' ? 'Light mode on' : 'Dark mode on');
  };

  return (
    <Modal title="Notifications" onClose={onClose} wide>
      <div className="modal-tabs">
        <button className={tab==='inbox'?'active':''} onClick={()=>setTab('inbox')}>Inbox</button>
        <button className={tab==='settings'?'active':''} onClick={()=>setTab('settings')}>Settings</button>
      </div>
      {tab==='inbox' ? (
        <div>
          <div style={{display:'flex', justifyContent:'flex-end', marginBottom:8}}>
            <button className="btn btn-ghost btn-sm" onClick={markAllRead}>Mark all as read</button>
          </div>
          {notifications.length === 0 ? (
            <div style={{fontSize:13, color:'var(--steel)', padding:'10px 0'}}>No notifications.</div>
          ) : notifications.map((n,i)=>(
            <motion.div
              key={n.id}
              style={{display:'flex', gap:10, padding:'12px 0', borderBottom:'1px solid var(--line)', cursor:'pointer'}}
              initial="hidden" animate="show" variants={stagger} custom={i}
              transition={{ duration: dur.fast, ease: ease.out }}
              onClick={() => n.unread && markRead(n.id)}
            >
              <span
                aria-hidden="true"
                style={{
                  width:8, height:8, borderRadius:'50%',
                  background: n.unread ? 'var(--signal)' : 'transparent',
                  marginTop:6, flexShrink:0,
                }}
              />
              <div style={{minWidth:0}}>
                {/* Title/body/time are pinned to --ink / --steel explicitly: the
                   modal sits on --surface, and these were inheriting, which
                   rendered dark-on-dark in some contexts. */}
                <div style={{fontWeight: n.unread ? 700 : 600, fontSize:13, color:'var(--ink)'}}>{n.title}</div>
                <div style={{fontSize:12, color:'var(--steel)', marginTop:2}}>{n.body}</div>
                <div className="mono" style={{fontSize:10.5, color:'var(--steel)', marginTop:2}}>{n.time}</div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div style={{fontSize:12.5}}>
          {/* Theme picker. Dark is the platform default, so the switch reads as
             "dark mode on" and turning it off lifts the whole app to light —
             the choice persists and is re-applied by the layout script on the
             next load, before first paint. */}
          <div className="checkbox-row">
            <span>Dark Mode</span>
            <Switch on={theme === 'dark'} onClick={switchTheme} ariaLabel="Toggle dark mode" />
          </div>
          <div style={{fontFamily:'var(--font-mono)', fontSize:10.5, color:'var(--steel)', marginTop:-4, marginBottom:6, letterSpacing:'.4px'}}>
            {theme === 'dark' ? 'ON — DARK THEME' : 'OFF — LIGHT THEME'}
          </div>
          <div className="checkbox-row"><span>Email Notifications</span><Switch on={notifPrefs.email} onClick={()=>toggle('email')} /></div>
          <div className="checkbox-row"><span>SMS Notifications</span><Switch on={notifPrefs.sms} onClick={()=>toggle('sms')} /></div>
          <div className="checkbox-row"><span>Session Reminders</span><Switch on={notifPrefs.reminders} onClick={()=>toggle('reminders')} /></div>
          <div className="checkbox-row" style={{borderBottom:'none'}}><span>Promotions &amp; Offers</span><Switch on={notifPrefs.promos} onClick={()=>toggle('promos')} /></div>
        </div>
      )}
    </Modal>
  );
}
export default NotificationsModal;
