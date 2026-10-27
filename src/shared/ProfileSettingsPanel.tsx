import { useState, type ReactNode } from 'react';
import type { NotifPrefs, Setter } from '../types.ts';

type ProfileSettingsTab = 'account' | 'profile' | 'security' | 'delete';

const TAB_LABELS: Record<ProfileSettingsTab, string> = {
  account: 'Account Information',
  profile: 'Profile Details',
  security: 'Security',
  delete: 'Delete Account',
};

export default function ProfileSettingsPanel({
  account,
  profile,
  profileIntro = 'Update the details shown on your account.',
  onOpenSecurity,
  notifPrefs,
  setNotifPrefs,
  deleteAccount,
}: {
  account: ReactNode;
  profile: ReactNode;
  profileIntro?: string;
  onOpenSecurity: () => void;
  notifPrefs: NotifPrefs;
  setNotifPrefs: Setter<NotifPrefs>;
  deleteAccount?: ReactNode;
}) {
  const [tab, setTab] = useState<ProfileSettingsTab>('account');
  const tabs: ProfileSettingsTab[] = deleteAccount
    ? ['account', 'profile', 'security', 'delete']
    : ['account', 'profile', 'security'];

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
            <p className="profile-settings-intro">{profileIntro}</p>
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
        {tab === 'delete' && deleteAccount}
      </div>
    </section>
  );
}
