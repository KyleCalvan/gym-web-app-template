import { useEffect, useState } from 'react';
import { Field, TabbedCard, TextInput } from '../shared';
import { DEFAULT_QR_DESTINATIONS, validateQrDestination } from '../qrDestinations.ts';
import type { QrDestination, ViewProps } from '../types.ts';

type QrEditorProps = Pick<ViewProps, 'toast'>
  & Partial<Pick<ViewProps, 'qrDestinations' | 'setQrDestinations' | 'addAudit'>>
  & { onSaveUrls?: (destinations: QrDestination[]) => Promise<void>; databaseMode?: boolean };

function QrDestinationEditor({ qrDestinations = DEFAULT_QR_DESTINATIONS, setQrDestinations, toast, addAudit, onSaveUrls }: QrEditorProps) {
  const [draft, setDraft] = useState(qrDestinations);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(qrDestinations), [qrDestinations]);

  const updateDestination = (id: string, url: string) => {
    setDraft((previous) => previous.map((destination) => destination.id === id ? { ...destination, url } : destination));
    setError('');
  };

  const addDestination = () => {
    setDraft((previous) => [...previous, { id: `custom-${Date.now()}`, label: '', url: '' }]);
  };

  const updateCustom = (id: string, updates: Partial<QrDestination>) => {
    setDraft((previous) => previous.map((destination) => destination.id === id ? { ...destination, ...updates } : destination));
    setError('');
  };

  const removeDestination = (id: string) => {
    setDraft((previous) => previous.filter((destination) => destination.id !== id));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const configured = draft.filter((destination) => destination.url.trim());
    if (configured.length === 0) {
      setError('Add at least one verified destination before saving.');
      return;
    }
    if (!configured.some((destination) => destination.id === 'facebook')) {
      setError('Configure the gym’s verified Facebook page before saving these links.');
      return;
    }
    for (const destination of configured) {
      if (!destination.label.trim()) {
        setError('Give every configured destination a clear label.');
        return;
      }
      const urlError = validateQrDestination(destination);
      if (urlError) {
        setError(`${destination.label}: ${urlError}`);
        return;
      }
    }
    const normalized = configured.map((destination) => ({ ...destination, label: destination.label.trim(), url: destination.url.trim() }));
    setSaving(true);
    try {
      if (onSaveUrls) await onSaveUrls(normalized);
      else setQrDestinations?.(draft.map((destination) => ({ ...destination, label: destination.label.trim(), url: destination.url.trim() })));
      setError('');
      toast(onSaveUrls ? 'Gym QR destinations saved.' : 'Gym QR destinations saved in this browser.');
      addAudit?.('info', 'Gym QR destinations updated', `${configured.length} destinations`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gym destinations could not be saved.');
    } finally { setSaving(false); }
  };

  return (
    <TabbedCard title="Gym QR Destinations">
      <p className="gym-qr-admin-intro">
        Set the gym’s official public URLs. Only HTTPS destinations are accepted; the Facebook field must point to a Facebook-owned domain.
        {onSaveUrls ? 'These links are saved in the gym database.' : 'These settings are stored in this browser and can be changed by an administrator.'}
      </p>
      <form onSubmit={save}>
        <div className="gym-qr-admin-fields">
          {draft.map((destination) => (
            <div className="gym-qr-admin-row" key={destination.id}>
              <Field label={destination.id === 'facebook' ? 'Verified Gym Facebook URL *' : `${destination.label || 'Custom destination'} URL`}>
                <TextInput
                  type="url"
                  placeholder={destination.id === 'facebook' ? 'https://www.facebook.com/your-official-gym-page' : 'https://'}
                  value={destination.url}
                  onChange={(url: string) => updateDestination(destination.id, url)}
                  aria-label={`${destination.label || 'Custom destination'} URL`}
                />
              </Field>
              {destination.id.startsWith('custom-') && (
                <>
                  <Field label="QR label *">
                    <TextInput
                      value={destination.label}
                      onChange={(label: string) => updateCustom(destination.id, { label })}
                    />
                  </Field>
                  <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => removeDestination(destination.id)}>Remove</button>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="gym-qr-admin-actions">
          <button type="button" className="btn btn-outline" onClick={addDestination}>Add destination</button>
          <button type="submit" className="btn btn-signal" disabled={saving}>{saving ? 'Saving…' : 'Validate and Save URLs'}</button>
        </div>
      </form>
      {error && <p className="gym-qr-error" role="alert">{error}</p>}
    </TabbedCard>
  );
}

type MemberQrRecord = { profileId: string; name: string; email: string; qrUpdatedAt: string | null };

function LiveAdminQr({ toast, addAudit }: QrEditorProps) {
  const [destinations, setDestinations] = useState<QrDestination[]>(DEFAULT_QR_DESTINATIONS);
  const [members, setMembers] = useState<MemberQrRecord[]>([]);
  const [memberId, setMemberId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch('/api/gym-qr', { cache: 'no-store' }),
      fetch('/api/admin/member-qr', { cache: 'no-store' }),
    ]).then(async ([linksResponse, membersResponse]) => {
      if (!linksResponse.ok || !membersResponse.ok) throw new Error('QR settings could not be loaded.');
      const links: { destinations: QrDestination[] } = await linksResponse.json();
      const directory: { members: MemberQrRecord[] } = await membersResponse.json();
      if (!active) return;
      setDestinations([...DEFAULT_QR_DESTINATIONS.filter(defaultItem => !links.destinations.some(item => item.id === defaultItem.id)), ...links.destinations]);
      setMembers(directory.members);
    }).catch(() => { if (active) setError('QR settings could not be loaded. Please refresh.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function saveUrls(next: QrDestination[]) {
    const response = await fetch('/api/gym-qr', { method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ destinations: next }) });
    if (!response.ok) throw new Error('Gym QR destinations could not be saved.');
    setDestinations([...DEFAULT_QR_DESTINATIONS.filter(item => !next.some(saved => saved.id === item.id)), ...next]);
  }

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!memberId || !file) { setError('Choose a member and QR image.'); return; }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1_500_000 || file.size === 0) {
      setError('Choose a PNG, JPEG, or WebP image under 1.5 MB.'); return;
    }
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.set('profileId', memberId);
      form.set('image', file);
      const response = await fetch('/api/admin/member-qr', { method: 'PUT', body: form });
      if (!response.ok) throw new Error('The member QR image could not be uploaded.');
      const result: { qrUpdatedAt: string } = await response.json();
      setMembers(previous => previous.map(member => member.profileId === memberId
        ? { ...member, qrUpdatedAt: result.qrUpdatedAt } : member));
      setFile(null);
      const input = document.getElementById('member-qr-image') as HTMLInputElement | null;
      if (input) input.value = '';
      toast('Member QR image saved.');
      addAudit?.('info', 'Member QR image updated', memberId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The member QR image could not be uploaded.');
    } finally { setUploading(false); }
  }

  if (loading) return <p role="status">Loading gym QR settings…</p>;
  if (error === 'QR settings could not be loaded. Please refresh.') return <p role="alert">{error}</p>;
  const selected = members.find(member => member.profileId === memberId);
  return <>
    <QrDestinationEditor qrDestinations={destinations} toast={toast} addAudit={addAudit} onSaveUrls={saveUrls} />
    <TabbedCard title="Member QR Upload">
      <p className="gym-qr-admin-intro">Upload a QR image for a specific member. It will appear in that member’s Gym Links & QR page.</p>
      <form onSubmit={upload}>
        {members.length === 0 && <p role="status">No member profiles are available for QR uploads yet.</p>}
        <div className="gym-qr-admin-fields">
          <Field label="Member">
            <select className="form-control" value={memberId} onChange={event => setMemberId(event.target.value)} required>
              <option value="">Choose a member</option>
              {members.map(member => <option key={member.profileId} value={member.profileId}>{member.name} — {member.email}</option>)}
            </select>
          </Field>
          <Field label="QR image (PNG, JPEG, or WebP; up to 1.5 MB)">
            <input id="member-qr-image" type="file" accept="image/png,image/jpeg,image/webp" required
              onChange={event => setFile(event.target.files?.[0] ?? null)} />
          </Field>
        </div>
        {selected && <p role="status">{selected.qrUpdatedAt ? 'A QR image is saved for this member. Uploading replaces it.' : 'No QR image saved for this member yet.'}</p>}
        <div className="gym-qr-admin-actions"><button type="submit" className="btn btn-signal" disabled={uploading}>{uploading ? 'Uploading…' : 'Upload member QR'}</button></div>
      </form>
      {error && <p className="gym-qr-error" role="alert">{error}</p>}
    </TabbedCard>
  </>;
}

function AdminQrDestinations(props: QrEditorProps) {
  return props.databaseMode ? <LiveAdminQr {...props} /> : <QrDestinationEditor {...props} />;
}

export default AdminQrDestinations;
