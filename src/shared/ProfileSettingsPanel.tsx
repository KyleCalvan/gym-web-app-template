import { useState, type ReactNode } from 'react';
import type { NotifPrefs, Setter } from '../types.ts';
import { Switch } from './primitives/Switch.tsx';

type ProfileSettingsTab = 'account' | 'profile' | 'security' | 'preferences' | 'delete';

const TAB_LABELS: Record<ProfileSettingsTab, string> = {
  account: 'Account Information',
  profile: 'Profile Details',
  security: 'Security',
  preferences: 'Preferences',
  delete: 'Delete Account',
};

export default function ProfileSettingsPanel({
  account,
  profile,
  onOpenSecurity,
  notifPrefs,
  setNotifPrefs,
  deleteAccount,
}: {
  account: ReactNode;
  profile: ReactNode;
  onOpenSecurity: () => void;
  notifPrefs: NotifPrefs;
  setNotifPrefs: Setter<NotifPrefs>;
  deleteAccount?: ReactNode;
}) {
  const [tab, setTab] = useState<ProfileSettingsTab>('account');
  const tabs: ProfileSettingsTab[] = deleteAccount
    ? ['account', 'profile', 'security', 'preferences', 'delete']
    : ['account', 'profile', 'security', 'preferences'];

  return (
    <section className="profile-settings-panel">
      <div className="profile-settings-tabs" role="tablist" aria-label="Profile settings">
        {tabs.map((item) => (
          <button
            key={item}
            id={`profile-tab-${item}`}
            type="button"
            role="tab"
            aria-selected={tab === item}
            aria-controls={`profile-panel-${item}`}
            className={`profile-settings-tab${tab === item ? ' is-active' : ''}${item === 'delete' ? ' is-danger' : ''}`}
            onClick={() => setTab(item)}
          >
            {TAB_LABELS[item]}
          </button>
        ))}
      </div>
      <div
        id={`profile-panel-${tab}`}
        className={`profile-settings-content${tab === 'delete' ? ' profile-settings-danger' : ''}`}
        role="tabpanel"
        aria-labelledby={`profile-tab-${tab}`}
      >
        {tab === 'account' && (
          <>
            <h2>Account Information</h2>
            <p className="profile-settings-intro">Your account identifiers and current status.</p>
            {account}
          </>
        )}
        {tab === 'profile' && (
          <>
            <h2>Profile Details</h2>
            <p className="profile-settings-intro">Update the details shown on your account.</p>
            {profile}
          </>
        )}
        {tab === 'security' && (
          <>
            <h2>Security</h2>
            <p className="profile-settings-intro">Manage your password and two-step verification in one place.</p>
            <div className="profile-security-card">
              <div>
                <strong>Password &amp; sign-in security</strong>
                <span>Change your password or manage two-step verification.</span>
              </div>
              <button className="btn btn-outline btn-sm" type="button" onClick={onOpenSecurity}>
                Open security settings
              </button>
            </div>
          </>
        )}
        {tab === 'preferences' && (
          <>
            <h2>Preferences</h2>
            <p className="profile-settings-intro">Choose which account notifications you want to receive.</p>
            <div className="profile-preference-list">
              <div><span><strong>Email notifications</strong><small>Account updates and important notices</small></span><Switch on={notifPrefs.email} onClick={() => setNotifPrefs((previous) => ({ ...previous, email: !previous.email }))} ariaLabel="Toggle email notifications" /></div>
              <div><span><strong>SMS notifications</strong><small>Time-sensitive updates by text message</small></span><Switch on={notifPrefs.sms} onClick={() => setNotifPrefs((previous) => ({ ...previous, sms: !previous.sms }))} ariaLabel="Toggle SMS notifications" /></div>
              <div><span><strong>Session reminders</strong><small>Reminders about upcoming sessions</small></span><Switch on={notifPrefs.reminders} onClick={() => setNotifPrefs((previous) => ({ ...previous, reminders: !previous.reminders }))} ariaLabel="Toggle session reminders" /></div>
              <div><span><strong>Promotions and offers</strong><small>News about gym promotions and offers</small></span><Switch on={notifPrefs.promos} onClick={() => setNotifPrefs((previous) => ({ ...previous, promos: !previous.promos }))} ariaLabel="Toggle promotions and offers" /></div>
            </div>
          </>
        )}
        {tab === 'delete' && deleteAccount}
      </div>
    </section>
  );
}
