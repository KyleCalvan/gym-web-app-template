import { useState } from 'react';
import { Avatar, TabbedCard } from '../shared';
import { onPickImage } from '../shared/imageUpload.ts';
import { SecurityFlow } from '../shared/components/SecurityFlow';
import ProfileSettingsPanel from '../shared/ProfileSettingsPanel';
import type { ViewProps } from '../types.ts';

function StaffProfile({ staff, setStaff, currentUserId, toast, addAudit, notifPrefs, setNotifPrefs, currentUser,
  onProfilePhotoChange, onStaffPhotoSave }: ViewProps) {
  const me = staff.find(s => s.id === currentUserId) || staff[0];
  const [showSecurityFlow, setShowSecurityFlow] = useState(false);

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onPickImage(file, async url => {
      if (onStaffPhotoSave) {
        try { await onStaffPhotoSave(url); toast('Photo updated'); }
        catch (error) { toast(error instanceof Error ? error.message : 'Could not update photo.'); }
        return;
      }
      onProfilePhotoChange?.(url);
      setStaff(prev => prev.map(s => s.id === me.id ? {...s, avatarUrl: url} : s));
      toast('Photo updated');
      addAudit?.('info', 'Profile photo updated', me?.id || 'staff');
    }, msg => toast(msg));
    e.target.value = '';
  };

  return (
    <div className="grid grid-1-2 profile-page-grid">
      <TabbedCard title={me?.name || currentUser?.name || 'Staff'}>
        <div className="profile-photo-content">
          <Avatar src={me?.avatarUrl || currentUser?.avatarUrl} name={me?.name || currentUser?.name || 'Staff'} size={96} />
          <div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => document.getElementById('staff-avatar-input')?.click()}
            >
              Change Photo
            </button>
            <input
              id="staff-avatar-input"
              type="file"
              accept="image/*"
              style={{display:'none'}}
              onChange={handleAvatarFile}
            />
          </div>
        </div>
      </TabbedCard>
      <div>
        <ProfileSettingsPanel
          account={
            <div className="profile-settings-account-grid">
              <div className="profile-settings-account-item"><div className="eyebrow">Staff ID</div><p className="mono">{me?.id || '—'}</p></div>
              <div className="profile-settings-account-item"><div className="eyebrow">Role</div><p>Staff</p></div>
              <div className="profile-settings-account-item"><div className="eyebrow">Staff Since</div><p className="mono">{me?.hireDate || '—'}</p></div>
            </div>
          }
          profile={
            <div className="profile-settings-account-grid">
              <div className="profile-settings-account-item"><div className="eyebrow">Full Name</div><p>{me?.name || currentUser?.name || '—'}</p></div>
              <div className="profile-settings-account-item"><div className="eyebrow">Email</div><p>{me?.email || '—'}</p></div>
              <div className="profile-settings-account-item"><div className="eyebrow">Phone</div><p>{me?.phone || '—'}</p></div>
              <div className="profile-settings-account-item"><div className="eyebrow">Phone (Secondary)</div><p>{me?.phoneSecondary || '—'}</p></div>
            </div>
          }
          profileIntro="Your profile details are managed by an administrator."
          onOpenSecurity={() => onStaffPhotoSave
            ? toast('Security changes require the account security service and are not available here yet.')
            : setShowSecurityFlow(true)}
          notifPrefs={notifPrefs}
          setNotifPrefs={setNotifPrefs}
        />
      </div>
      <SecurityFlow isOpen={showSecurityFlow} onClose={() => setShowSecurityFlow(false)} toast={toast} role="staff" accountEmail={me?.email || ''} />
    </div>
  );
}

export default StaffProfile;
