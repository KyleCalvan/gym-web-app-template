// @ts-nocheck
import { motion } from 'framer-motion';
import { dur, ease, stagger } from '../motion.tsx';

function PromoStrip({ promotionsRef, activePromos }) {
  return (
    <section className="promo-strip" id="promotions" ref={promotionsRef}>
      <div className="promo-strip-inner">
        <h2>Current Promotions</h2>
        <p className="sub">Take advantage of our limited-time offers</p>
        <div className="promo-grid">
          {activePromos.map((p, i) => (
            <motion.div
              className="promo-card"
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: dur.base, delay: i * stagger.list, ease: ease.out }}
              whileHover={{ y: -2, boxShadow: '6px 6px 0 rgba(22,36,31,0.18)' }}
            >
              <div
                className="thumb"
                style={{ backgroundImage: 'url(' + (p.imageUrl || '/gym-interior.jpg') + ')' }}
                aria-hidden="true"
              />
              <span className="tag">
                {p.discountType === 'Percentage' ? (p.discount + ' OFF') :
                 p.discountType === 'Bundle'     ? 'BUNDLE DEAL' :
                 p.discountType === 'Fixed'      ? ('₱' + p.discount + ' OFF') :
                 'SPECIAL'}
              </span>
              <h3>{p.title}</h3>
              <p>{p.code ? 'Use code ' + p.code + ' at checkout.' : 'Limited time offer.'}</p>
              <div className="valid">VALID UNTIL {String(p.validUntil).toUpperCase()}</div>
            </motion.div>
          ))}
          {activePromos.length === 0 && (
            <div className="empty-state">No active promotions right now.</div>
          )}
        </div>
      </div>
    </section>
  );
}

export default PromoStrip;