import { useEffect, useState } from 'react';
import GymQrLinks from '../shared/GymQrLinks.tsx';
import type { ViewProps } from '../types.ts';
import type { QrDestination } from '../types.ts';

type Props = Partial<Pick<ViewProps, 'qrDestinations'>> & { databaseMode?: boolean };

export default function TrainerContactLinks({ qrDestinations = [], databaseMode = false }: Props) {
  const [savedDestinations, setSavedDestinations] = useState<QrDestination[]>([]);
  const [loading, setLoading] = useState(databaseMode);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!databaseMode) return;
    const controller = new AbortController();
    fetch('/api/gym-qr', { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Gym links could not be loaded.');
        return data as { destinations: QrDestination[] };
      })
      .then(data => { setSavedDestinations(data.destinations); setLoading(false); setError(''); })
      .catch(cause => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : 'Gym links could not be loaded.');
        setLoading(false);
      });
    return () => controller.abort();
  }, [databaseMode, attempt]);

  if (databaseMode && loading) return <p role="status">Loading gym links and QR codes…</p>;
  if (databaseMode && error) return <p role="alert">{error} <button type="button" onClick={() => { setLoading(true); setAttempt(value => value + 1); }}>Retry</button></p>;
  return <GymQrLinks destinations={databaseMode ? savedDestinations : qrDestinations} />;
}
