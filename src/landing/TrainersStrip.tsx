// @ts-nocheck
import { Star } from 'lucide-react';
import RevealCard from './RevealCard.tsx';
import SectionHeading from './SectionHeading.tsx';

function TrainersStrip({ trainersRef, activeTrainers, onNavigate }) {
  return (
    <section
      className="trainers-strip"
      id="trainers"
      ref={trainersRef}
      aria-labelledby="trainers-heading"
    >
      <div className="trainers-strip-inner">
        <SectionHeading
          id="trainers-heading"
          title="Meet Our Trainers"
          sub="Certified coaches who specialize in strength, mobility, and conditioning."
        />
        <div className="trainers-grid">
          {activeTrainers.map((t) => (
            <RevealCard key={t.id} className="trainer-card soft-card">
              <div className="avatar" aria-hidden="true">
                {t.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
              </div>
              <div className="spec">{t.specialty}</div>
              <h3>{t.name}</h3>
              <div className="meta">
                <div className="row"><span>Certifications</span><b>{t.certs}</b></div>
                <div className="row"><span>Rating</span><b className="mono rating"><Star size={12} fill="currentColor" strokeWidth={0} aria-hidden="true" /> {t.rating}</b></div>
              </div>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => onNavigate && onNavigate('/login')}
              >Book a Session</button>
            </RevealCard>
          ))}
          {activeTrainers.length === 0 && (
            <div className="empty-state">Our trainer roster will be posted soon.</div>
          )}
        </div>
      </div>
    </section>
  );
}

export default TrainersStrip;
