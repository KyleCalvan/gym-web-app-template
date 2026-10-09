// @ts-nocheck
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { dur, ease, stagger } from '../motion.tsx';
import HeroImage from './HeroImage.tsx';
import { scrollToSection } from './landing-utils.ts';
import { LANDING_STATS } from './landing-mock.ts';

function LandingHero({ onNavigate }) {
  const heroItem = (i) => ({
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.08 + i * stagger.tile, duration: dur.base, ease: ease.out },
  });

  return (
    <section className="landing-hero" aria-labelledby="hero-heading">
      <div className="hero-blob hero-blob-1" />
      <div className="hero-blob hero-blob-2" />
      <HeroImage className="hero-photo-bg" />
      <div className="landing-hero-inner">
        <div>
          <motion.div className="eyebrow" {...heroItem(0)}>
            Gym Management, Squared Away
          </motion.div>
          <motion.h1 id="hero-heading" {...heroItem(1)}>
            Run your gym like a{' '}
            <span className="accent-word">
              champion&nbsp;runs
              <motion.span
                className="vm-underline"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.5, delay: 0.3, ease: ease.out }}
                style={{ transformOrigin: 'left center' }}
              />
            </span>{' '}
            a season.
          </motion.h1>
          <motion.p className="lede" {...heroItem(2)}>
            Memberships, coaching schedules, point-of-sale and reporting — one ledger for admins, staff, trainers and members alike.
          </motion.p>
          <motion.div className="btn-group" {...heroItem(3)}>
            <button
              className="btn btn-signal"
              onClick={() => onNavigate && onNavigate('/login')}
            >Get Started</button>
            <a
              href="#promotions"
              className="btn btn-outline"
              onClick={(e) => scrollToSection(e, 'promotions')}
            >View Promotions</a>
          </motion.div>
          <motion.div className="hero-stats" {...heroItem(4)}>
            {LANDING_STATS.map((s) => (
              <span key={s.label} className="stat">
                <span className="dot" aria-hidden="true" /> {s.value}
                {s.icon === 'star' && (
                  <Star size={12} fill="currentColor" strokeWidth={0} className="star-ic" aria-hidden="true" />
                )}
                {' '}{s.label}
              </span>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default LandingHero;
