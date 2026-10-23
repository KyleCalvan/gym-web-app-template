import { useEffect, useState } from 'react';
import {
  createQrDestination,
  deleteQrDestination,
  fetchQrDestinations,
  updateQrDestination,
} from '../lib/api-client.ts';
import { Field, TabbedCard, TextInput } from '../shared';
import { DEFAULT_QR_DESTINATIONS, validateQrDestination } from '../qrDestinations.ts';
import type { QrDestination, ViewProps } from '../types.ts';

function AdminQrDestinations({ qrDestinations = DEFAULT_QR_DESTINATIONS, setQrDestinations, toast, addAudit }: ViewProps) {
  const [draft, setDraft] = useState(qrDestinations);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  // Ids of rows that already exist in the database, so saving can tell an
  // update from a create and can delete destinations the admin removed.
  const [persistedIds, setPersistedIds] = useState<string[]>([]);

  useEffect(() => setDraft(qrDestinations), [qrDestinations]);

  useEffect(() => {
    let cancelled = false;
    fetchQrDestinations()
      .then((list) => {
        if (cancelled) return;
        setPersistedIds(list.map((destination) => destination.id));
        if (list.length > 0) {
          setDraft(list);
          setQrDestinations?.(list);
        }
      })
      .catch(() => {
        // Leave the defaults in place; saving will surface any real failure.
      });
    return () => { cancelled = true; };
  }, []);

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
    const cleaned = draft
      .filter((destination) => destination.url.trim())
      .map((destination) => ({ ...destination, label: destination.label.trim(), url: destination.url.trim() }));

    setSaving(true);
    try {
      const kept: string[] = [];
      for (const destination of cleaned) {
        if (persistedIds.includes(destination.id)) {
          await updateQrDestination(destination.id, { label: destination.label, url: destination.url });
          kept.push(destination.id);
        } else {
          const created = await createQrDestination({ label: destination.label, url: destination.url });
          kept.push(created.id);
        }
      }
      for (const id of persistedIds) {
        if (!kept.includes(id)) await deleteQrDestination(id);
      }

      const fresh = await fetchQrDestinations();
      setPersistedIds(fresh.map((destination) => destination.id));
      setDraft(fresh);
      setQrDestinations?.(fresh);
      setError('');
      toast('Gym QR destinations saved.');
      addAudit?.('info', 'Gym QR destinations updated', `${cleaned.length} destinations`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the QR destinations.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <TabbedCard title="Gym QR Destinations">
      <p className="gym-qr-admin-intro">
        Set the gym’s official public URLs. Only HTTPS destinations are accepted; the Facebook field must point to a Facebook-owned domain.
        These settings are stored on the gym server and can be changed by an administrator.
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

export default AdminQrDestinations;
