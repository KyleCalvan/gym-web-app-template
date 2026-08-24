// @ts-nocheck
import { motion } from 'framer-motion';
import { dur, ease, stagger } from '../motion.tsx';
import MembershipCard from './MembershipCard.tsx';

function LandingHero({ heroRef, onHeroMove, onHeroLeave, cardX, cardY, onNavigate }) {
  const heroItem = (i) => ({
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.08 + i * stagger.tile, duration: dur.base, ease: ease.out },
  });

  return (
    <div
      className="landing-hero"
      ref={heroRef}
      onMouseMove={onHeroMove}
      onMouseLeave={onHeroLeave}
    >
      <div className="hero-blob hero-blob-1" />
      <div className="hero-blob hero-blob-2" />
      <div className="landing-hero-inner">
        <div>
          <motion.div className="eyebrow" style={{ marginBottom: 14 }} {...heroItem(0)}>
            Gym Management, Squared Away
          </motion.div>
          <motion.h1 {...heroItem(1)}>
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
          <motion.div className="btn-group" style={{ display: 'flex', gap: 12 }} {...heroItem(3)}>
            <button
              className="btn btn-signal"
              onClick={() => onNavigate && onNavigate('/login')}
            >Get Started</button>
            <a
              href="#promotions"
              className="btn btn-outline"
              onClick={(e) => {
                const el = document.getElementById('promotions');
                if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
              }}
            >View Promotions</a>
          </motion.div>
          <motion.div className="hero-stats" {...heroItem(4)}>
            <span className="stat"><span className="dot" /> 1,200+ Active Members</span>
            <span className="stat"><span className="dot" /> 50+ Classes Weekly</span>
            <span className="stat"><span className="dot" /> 4.8★ Avg Rating</span>
          </motion.div>
        </div>
        <MembershipCard cardX={cardX} cardY={cardY} />
      </div>
    </div>
  );
}

export default LandingHero;