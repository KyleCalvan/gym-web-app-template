// @ts-nocheck
import { motion } from 'framer-motion';
import { dur, ease } from '../motion.tsx';

function TrainersStrip({ trainersRef, activeTrainers, onNavigate }) {
  return (
    <section
      className="trainers-strip"
      id="trainers"
      ref={trainersRef}
      aria-labelledby="trainers-heading"
    >
      <div className="trainers-strip-inner">
        <h2 id="trainers-heading">Meet Our Trainers</h2>
        <p className="sub">Certified coaches who specialize in strength, mobility, and conditioning.</p>
        <div className="trainers-grid">
          {activeTrainers.map((t) => (
            <motion.div
              className="trainer-card soft-card"
              key={t.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: dur.base, ease: ease.out }}
            >
              <div className="avatar" aria-hidden="true">
                {t.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
              </div>
              <div className="spec">{t.specialty}</div>
              <h3>{t.name}</h3>
              <div className="meta">
                <div className="row"><span>Certifications</span><b>{t.certs}</b></div>
                <div className="row"><span>Rating</span><b className="mono">★ {t.rating}</b></div>
              </div>
              <button
                className="btn btn-outline btn-sm"
                style={{ marginTop: 10 }}
                onClick={() => onNavigate && onNavigate('/login')}
              >Book a Session</button>
            </motion.div>
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
