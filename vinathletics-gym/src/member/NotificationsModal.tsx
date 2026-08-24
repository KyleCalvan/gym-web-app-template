// @ts-nocheck
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Modal, Switch } from '../shared';
import { dur, ease, stagger } from '../motion.tsx';
import type { Notification, NotifPrefs, Setter } from '../../types.ts';

function NotificationsModal({ onClose, notifications, setNotifications, notifPrefs, setNotifPrefs, toast }: {
  onClose: () => void;
  notifications: Notification[];
  setNotifications: Setter<Notification[]>;
  notifPrefs: NotifPrefs;
  setNotifPrefs: Setter<NotifPrefs>;
  toast: (msg: string) => void;
}){
  const [tab, setTab] = useState('inbox');
  const markRead = (id) => {
    setNotifications(prev => prev.map(n => n.id===id ? {...n, unread:false} : n));
  };
  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({...n, unread:false})));
    toast('All notifications marked as read');
  };

  const toggle = (key) => {
    setNotifPrefs(p => ({...p, [key]: !p[key]}));
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
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: dur.base, delay: i * stagger.list, ease: ease.out }}
              onClick={() => n.unread && markRead(n.id)}
            >
              <span style={{width:8, height:8, borderRadius:'50%', background: n.unread?'var(--signal)':'transparent', marginTop:6, flexShrink:0}}></span>
              <div>
                <div style={{fontWeight: n.unread ? 700 : 600, fontSize:13}}>{n.title}</div>
                <div style={{fontSize:12, color:'var(--steel)'}}>{n.body}</div>
                <div className="mono" style={{fontSize:10.5, color:'var(--steel)', marginTop:2}}>{n.time}</div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div style={{fontSize:12.5}}>
          <div className="checkbox-row"><span>Email Notifications</span><Switch on={notifPrefs.email} onClick={()=>toggle('email')} /></div>
          <div className="checkbox-row"><span>SMS Notifications</span><Switch on={notifPrefs.sms} onClick={()=>toggle('sms')} /></div>
          <div className="checkbox-row"><span>Session Reminders</span><Switch on={notifPrefs.reminders} onClick={()=>toggle('reminders')} /></div>
          <div className="checkbox-row" style={{borderBottom:'none'}}><span>Promotions & Offers</span><Switch on={notifPrefs.promos} onClick={()=>toggle('promos')} /></div>
        </div>
      )}
    </Modal>
  );
}

export default NotificationsModal;