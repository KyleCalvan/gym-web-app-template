// @ts-nocheck
import { useMemo, useState } from 'react';
import { Badge, TabbedCard } from '../shared';
import { ArrowUpRight, Copy, Gift } from 'lucide-react';
import {
  formatPromotionDate,
  formatPromotionDiscount,
  getActivePromotionsForMember,
  getEligiblePromotions,
  promotionTargetsAllPlans,
} from './promotionEligibility.ts';

function MemberPromotions({
  promotions, members, currentUserId, toast, promotionRedemptions, today,
}) {
  const me = members.find((member) => member.id === currentUserId) || members[0];
  const eligiblePromotions = useMemo(
    () => getEligiblePromotions(promotions || [], me, today || new Date()),
    [promotions, me?.plan, today],
  );
  const [selectedId, setSelectedId] = useState(null);
  const selected = eligiblePromotions.find((promotion) => promotion.id === selectedId) || eligiblePromotions[0];

  const myRedemptions = useMemo(
    () => (promotionRedemptions || []).filter((r) => r.memberId === me?.id),
    [promotionRedemptions, me?.id],
  );
  const activePromotions = useMemo(
    () => getActivePromotionsForMember(promotions || [], myRedemptions, me, today || new Date()),
    [promotions, myRedemptions, me?.plan, today],
  );

  const copyCode = async (code) => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast(`Promotion code ${code} copied`);
    } catch {
      toast(`Copy this promotion code: ${code}`);
    }
  };

  return (
    <TabbedCard title="Available promotions">
      {activePromotions.length > 0 && (
        <div className="member-promo-active" aria-label="Your redeemed offers">
          <div className="member-promo-active-head">
            <h3>Your redeemed offers</h3>
            <span>Present these codes to gym staff when making a purchase.</span>
          </div>
          <ul className="member-promo-active-list">
            {activePromotions.map((promo) => {
              return (
                <li key={promo.id} className="member-promo-active-item">
                  <div className="member-promo-active-main">
                    <strong>{promo.title}</strong>
                    <span className="member-promo-discount">{formatPromotionDiscount(promo)}</span>
                  </div>
                  <div className="member-promo-active-meta">
                    <span>Code <strong className="mono">{promo.code}</strong></span>
                    <span>Valid through {formatPromotionDate(promo.validUntil)}</span>
                    <span>
                      Applies to: {promotionTargetsAllPlans(promo)
                        ? 'All membership plans and trainer sessions'
                        : `${promo.plan} plan`}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {eligiblePromotions.length === 0 ? (
        <div className="member-promo-empty">
          <Gift size={28} aria-hidden="true" />
          <h3>No active promotions available to you</h3>
          <p>Published offers will appear here while their dates and eligibility requirements are valid.</p>
        </div>
      ) : (
        <div className="member-promotions-layout">
          <nav className="member-promo-list" aria-label="Available promotions">
            {eligiblePromotions.map((promotion) => (
              <button
                type="button"
                className={`member-promo-option${selected?.id === promotion.id ? ' selected' : ''}`}
                key={promotion.id}
                onClick={() => setSelectedId(promotion.id)}
                aria-pressed={selected?.id === promotion.id}
              >
                {promotion.imageUrl && <img src={promotion.imageUrl} alt="" loading="lazy" />}
                <span className="member-promo-option-copy">
                  <strong>{promotion.title}</strong>
                  <span>{formatPromotionDiscount(promotion)}</span>
                  <small>Valid through {formatPromotionDate(promotion.validUntil)}</small>
                </span>
                <ArrowUpRight size={16} aria-hidden="true" />
              </button>
            ))}
          </nav>

          {selected && (
            <article className="member-promo-detail">
              <div className="member-promo-detail-top">
                <Badge status="Published" />
                <span className="member-promo-discount">{formatPromotionDiscount(selected)}</span>
              </div>
              <h3>{selected.title}</h3>
              <p className="member-promo-description">
                {selected.description || 'A current offer available to members who meet the conditions below.'}
              </p>
              <dl className="member-promo-rules">
                <div><dt>Applicable plan</dt><dd>{selected.plan === 'Any' || selected.plan === 'Any Plan' ? 'All plans & sessions' : selected.plan}</dd></div>
                <div><dt>Valid from</dt><dd>{formatPromotionDate(selected.validFrom)}</dd></div>
                <div><dt>Valid until</dt><dd>{formatPromotionDate(selected.validUntil)}</dd></div>
                <div><dt>Minimum spend</dt><dd>{Number(selected.minSpend) > 0 ? `₱${Number(selected.minSpend).toLocaleString('en-PH')}` : 'None'}</dd></div>
                <div><dt>Redemptions</dt><dd>{Number(selected.maxRedemptions) > 0 ? `${Math.max(0, Number(selected.maxRedemptions) - Number(selected.redemptions || 0))} remaining` : 'No stated limit'}</dd></div>
              </dl>
              <div className="member-promo-code-row">
                <div><span>Use code</span><strong className="mono">{selected.code || 'Ask staff'}</strong></div>
                {selected.code && (
                  <>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => copyCode(selected.code)}>
                      <Copy size={15} aria-hidden="true" /> Copy code
                    </button>
                  </>
                )}
              </div>
              <p className="member-promo-disclaimer">Online code redemption is not available yet. Ask gym staff how to use this offer.</p>
            </article>
          )}
        </div>
      )}
    </TabbedCard>
  );
}

export default MemberPromotions;
