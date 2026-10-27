'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ArrowUpRight, QrCode } from 'lucide-react';
import { TabbedCard } from './primitives/TabbedCard.tsx';
import type { QrDestination } from '../types.ts';
import { validateQrDestination } from '../qrDestinations.ts';

interface GymQrLinksProps {
  destinations?: QrDestination[];
  memberQrUrl?: string | null;
}

interface GeneratedQr {
  dataUrl?: string;
  error?: string;
}

export default function GymQrLinks({ destinations = [], memberQrUrl }: GymQrLinksProps) {
  const [codes, setCodes] = useState<Record<string, GeneratedQr>>({});
  const safeDestinations = destinations.filter(
    (destination) => destination.url.trim() && !validateQrDestination(destination),
  );

  useEffect(() => {
    let current = true;
    Promise.all(safeDestinations.map(async (destination) => {
      try {
        const dataUrl = await QRCode.toDataURL(destination.url.trim(), {
          errorCorrectionLevel: 'H',
          margin: 4,
          width: 300,
          color: { dark: '#10120F', light: '#FFFFFF' },
        });
        return [destination.id, { dataUrl }] as const;
      } catch (error) {
        console.error(`Could not create QR code for ${destination.label}.`, error);
        return [destination.id, { error: 'QR code could not be generated. Please contact an administrator.' }] as const;
      }
    })).then((entries) => {
      if (current) setCodes(Object.fromEntries(entries));
    });
    return () => { current = false; };
  }, [destinations]);

  return (
    <TabbedCard title="Connect with VinAthletics">
      <p className="gym-qr-intro">
        {memberQrUrl ? 'Your member QR appears below. Scan the other codes to open the gym’s official links.'
          : 'Scan a QR code with your phone camera to open the labeled official gym destination. Check the displayed URL before continuing.'}
      </p>
      {safeDestinations.length === 0 && !memberQrUrl ? (
        <div className="gym-qr-empty" role="status">
          <QrCode size={28} aria-hidden="true" />
          <strong>Gym links are not configured yet</strong>
          <span>An administrator must add and save the gym’s verified Facebook page and other destinations first.</span>
        </div>
      ) : (
        <div className="gym-qr-grid">
          {memberQrUrl && <article className="gym-qr-card">
            <h3>My gym QR code</h3>
            <img className="gym-qr-image" src={memberQrUrl} alt="Your gym QR code uploaded by an administrator" />
          </article>}
          {safeDestinations.map((destination) => {
            const code = codes[destination.id];
            return (
              <article className="gym-qr-card" key={destination.id}>
                <h3>{destination.label}</h3>
                <p className="gym-qr-url">{destination.url}</p>
                {code?.dataUrl ? (
                  <img className="gym-qr-image" src={code.dataUrl} alt={`QR code for ${destination.label}`} />
                ) : code?.error ? (
                  <p className="gym-qr-error" role="alert">{code.error}</p>
                ) : (
                  <div className="gym-qr-loading" role="status">Generating QR code…</div>
                )}
                <a className="btn btn-outline btn-sm" href={destination.url} target="_blank" rel="noopener noreferrer">
                  Open verified destination <ArrowUpRight size={14} aria-hidden="true" />
                </a>
              </article>
            );
          })}
        </div>
      )}
      {!safeDestinations.some((destination) => destination.id === 'facebook') && (
        <p className="gym-qr-notice" role="note">The gym’s Facebook URL has not been configured. Ask an administrator to add the verified page.</p>
      )}
    </TabbedCard>
  );
}
