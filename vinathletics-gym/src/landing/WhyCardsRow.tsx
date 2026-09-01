// @ts-nocheck
import { motion } from 'framer-motion';
import { LayoutDashboard, Calendar, BarChart3, Shield } from 'lucide-react';
import { dur, ease, stagger } from '../motion.tsx';

function WhyCardsRow() {
  const whyTiles = [
    { Icon: LayoutDashboard, title: 'A COMMUNITY THAT MOTIVATES', body: 'Train alongside people who share your goals, celebrate your wins, and keep you accountable.' },
    { Icon: Calendar,        title: 'TRACK YOUR PROGRESS', body: 'See your strength, performance, consistency, and milestones improve over time' },
    { Icon: BarChart3,       title: 'BUILT FOR EVERY LEVEL', body: "Whether you're just getting started or chasing your next personal best, train in an environment designed for you" },
    { Icon: Shield,          title: 'FEEL PART OF SOMETHING', body: 'Train alongside a community that brings energy, encouragement, and a shared commitment to getting better' },
  ];

  return (
    <section className="hero-cards-row" id="why" aria-labelledby="why-heading">
      <div className="hero-cards-row-inner">
        <h2 id="why-heading">WHY MEMBERS PICK VINATHLETICS</h2>
        <p className="sub">Everything you need under one roof, from world-class equipment to certified coaches.</p>
        <div className="hero-cards-grid">
          {whyTiles.map((c, i) => {
            const Icon = c.Icon;
            return (
              <motion.div
                className="hero-card soft-card"
                key={c.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: dur.base, delay: i * stagger.list, ease: ease.out }}
              >
                <div className="ic" aria-hidden="true">
                  <Icon size={22} strokeWidth={2} />
                </div>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
                <a className="link" href="#promotions"
                  onClick={(e) => {
                    const el = document.getElementById('promotions');
                    if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
                  }}
                >Learn More →</a>
              </motion.div>
            );
          })}
        </div>

        <div className="why-bottom-section" style={{ marginTop: 64, borderTop: '1px solid var(--steel-light)', paddingTop: 64 }}>
          <div className="why-bottom-inner" style={{ display: 'flex', gap: 48, marginBottom: 64 }}>
            <div className="why-left" style={{ flex: 1 }}>
              <h3 style={{ fontSize: 24, margin: '0 0 8px' }}>MORE THAN A WORKOUT.</h3>
              <h3 style={{ fontSize: 24, margin: '0 0 16px', color: 'var(--signal)' }}>A BETTER YOU.</h3>
              <p style={{ color: 'var(--steel)', fontSize: 15, lineHeight: 1.6 }}>
                We're here to support every part of your fitness journey, inside and outside the gym.
              </p>
            </div>
            <div className="why-right-grid" style={{ flex: 2, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 24 }}>
              {[
                { label: 'ACHIEVE YOUR GOALS', text: 'Programs and tools designed to help you stay focused and make real progress.' },
                { label: 'STAY CONSISTENT', text: 'Easy booking, reminders, and tracking to keep you on track.' },
                { label: 'FEEL CONNECTED', text: 'A supportive community that inspires you to show up and keep going.' },
                { label: 'TRAIN WITH CONFIDENCE', text: 'Quality equipment and certified coaches focused on your safety and results.' },
                { label: 'CELEBRATE EVERY WIN', text: 'From small victories to big milestones, we\'re here to celebrate your journey.' },
              ].map((item) => (
                <div key={item.label} style={{ display: 'flex', flexDirection: 'column' }}>
                  <h4 style={{ fontSize: 12, fontWeight: 'bold', margin: '0 0 8px', textTransform: 'uppercase' }}>{item.label}</h4>
                  <p style={{ fontSize: 13, color: 'var(--steel)', lineHeight: 1.5, margin: 0 }}>{item.text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="why-trust-row" style={{ display: 'flex', justifyContent: 'center', gap: 48, fontSize: 12, fontWeight: 'bold', color: 'var(--steel)', textTransform: 'uppercase', letterSpacing: 1 }}>
            <span>YOUR DATA IS SECURE</span>
            <span>TRUSTED BY THOUSANDS</span>
            <span>WE'RE WITH YOU EVERY STEP</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default WhyCardsRow;
