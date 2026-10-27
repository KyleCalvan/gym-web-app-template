import { useEffect, useState } from 'react';
import { Field, TabbedCard, TextInput } from '../shared';
import { DEFAULT_QR_DESTINATIONS, validateQrDestination } from '../qrDestinations.ts';
import type { QrDestination, ViewProps } from '../types.ts';

function AdminQrDestinations({ qrDestinations = DEFAULT_QR_DESTINATIONS, setQrDestinations, toast, addAudit, onAdminAction }: ViewProps) {
  const displayed = qrDestinations.length ? qrDestinations : DEFAULT_QR_DESTINATIONS;
  const [draft, setDraft] = useState(displayed);
  const [error, setError] = useState('');

  useEffect(() => setDraft(qrDestinations.length ? qrDestinations : DEFAULT_QR_DESTINATIONS), [qrDestinations]);

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
    try {
      await onAdminAction?.('qr.save', { destinations: configured.map((destination) => ({ ...destination,
        label: destination.label.trim(), url: destination.url.trim() })) });
      setError('');
      toast('Gym QR destinations saved.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gym QR destinations could not be saved.');
    }
  };

  return (
    <TabbedCard title="Gym QR Destinations">
      <p className="gym-qr-admin-intro">
        Set the gym’s official public URLs. Only HTTPS destinations are accepted; the Facebook field must point to a Facebook-owned domain.
        These settings are stored in the gym database and can be changed by an administrator.
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
          <button type="submit" className="btn btn-signal">Validate and Save URLs</button>
        </div>
      </form>
      {error && <p className="gym-qr-error" role="alert">{error}</p>}
    </TabbedCard>
  );
}

export default AdminQrDestinations;
