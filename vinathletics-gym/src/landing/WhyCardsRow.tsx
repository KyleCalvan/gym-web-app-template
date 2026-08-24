// @ts-nocheck
import { motion } from 'framer-motion';
import { dur, ease, stagger } from '../motion.tsx';

function WhyCardsRow() {
  const whyTiles = [
    { ic: '📋', title: 'All-in-One Management',       body: 'Handle memberships, billing, attendance, and reporting in one seamless system.' },
    { ic: '📅', title: 'Smarter Schedules & Coaching', body: 'Easily manage classes, sessions, and trainer availability.' },
    { ic: '📊', title: 'Real-Time Reporting',          body: 'Track performance, member engagement, and business growth in real time.' },
    { ic: '🏦', title: 'Secure & Reliable',            body: 'Your data is safe with us, so you can focus on what matters most.' },
  ];

  return (
    <section className="hero-cards-row">
      <div className="hero-cards-row-inner">
        <h2>Why Members Pick VinAthletics</h2>
        <p className="sub">Everything you need under one roof — from world-class equipment to certified coaches.</p>
        <div className="hero-cards-grid">
          {whyTiles.map((c, i) => (
            <motion.div
              className="hero-card"
              key={i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: dur.base, delay: i * stagger.list, ease: ease.out }}
            >
              <div className="ic">{c.ic}</div>
              <h3>{c.title}</h3>
              <p>{c.body}</p>
            </motion.div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 36 }}>
          <button className="btn btn-outline btn-sm">Learn More</button>
        </div>
      </div>
    </section>
  );
}

export default WhyCardsRow;