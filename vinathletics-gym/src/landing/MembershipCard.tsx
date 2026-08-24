// @ts-nocheck
import { motion } from 'framer-motion';
import { dur, ease } from '../motion.tsx';

function MembershipCard({ cardX, cardY }) {
  return (
    <motion.div
      className="membership-card"
      style={{ x: cardX, y: cardY }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: dur.slow, delay: 0.15, ease: ease.out }}
    >
      <div className="mc-top">
        <div className="mc-org">VinAthletics Gym</div>
        <div className="mc-chip"></div>
      </div>
      <div className="mc-name">Juan Dela Cruz</div>
      <div className="mc-row">
        <div>Plan<b>Premium</b></div>
        <div>Member ID<b>M-1042</b></div>
        <div>Valid Thru<b>09/2026</b></div>
      </div>
    </motion.div>
  );
}

export default MembershipCard;