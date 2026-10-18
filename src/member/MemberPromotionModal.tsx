// @ts-nocheck
import { Badge, Modal } from '../shared';
import { ArrowRight, Copy, Gift } from 'lucide-react';
import { formatPromotionDate, formatPromotionDiscount } from './promotionEligibility.ts';

function MemberPromotionModal({ promotion, onClose, onViewPromotions, toast }) {
  const copyCode = async () => {
    if (!promotion?.code) return;
    try {
      await navigator.clipboard.writeText(promotion.code);
      toast(`Promotion code ${promotion.code} copied`);
    } catch {
      toast(`Use promotion code: ${promotion.code}`);
    }
  };

  return (
    <Modal title="A member offer for you" onClose={onClose} wide>
      <div className="member-promo-spotlight">
        {promotion.imageUrl && <img className="member-promo-spotlight-image" src={promotion.imageUrl} alt="" />}
        <div className="member-promo-spotlight-content">
          <div className="member-promo-spotlight-label"><Gift size={16} aria-hidden="true" /> Member promotion</div>
          <div className="member-promo-spotlight-meta">
            <Badge status="Published" />
            <span className="member-promo-discount">{formatPromotionDiscount(promotion)}</span>
          </div>
          <h3>{promotion.title}</h3>
          <p>{promotion.description || `An active offer for ${promotion.plan === 'Any' || promotion.plan === 'Any Plan' ? 'all membership plans' : promotion.plan}.`}</p>
          <dl className="member-promo-spotlight-rules">
            <div><dt>Eligible plan</dt><dd>{promotion.plan === 'Any' || promotion.plan === 'Any Plan' ? 'All plans' : promotion.plan}</dd></div>
            <div><dt>Validity</dt><dd>{formatPromotionDate(promotion.validFrom)} – {formatPromotionDate(promotion.validUntil)}</dd></div>
            <div><dt>Conditions</dt><dd>{Number(promotion.minSpend) > 0 ? `Minimum spend ₱${Number(promotion.minSpend).toLocaleString('en-PH')}` : 'No minimum spend'}{Number(promotion.maxRedemptions) > 0 ? ` · ${Math.max(0, Number(promotion.maxRedemptions) - Number(promotion.redemptions || 0))} redemptions left` : ''}</dd></div>
          </dl>
          <div className="member-promo-spotlight-actions">
            {promotion.code && <button type="button" className="btn btn-signal" onClick={copyCode}><Copy size={16} aria-hidden="true" /> Copy code {promotion.code}</button>}
            <button type="button" className="btn btn-outline" onClick={onViewPromotions}>View all promotions <ArrowRight size={16} aria-hidden="true" /></button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Dismiss</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default MemberPromotionModal;
