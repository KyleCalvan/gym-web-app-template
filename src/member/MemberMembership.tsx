// @ts-nocheck
import { useMemo, useState } from 'react';
import { Badge, Dropdown, Field, Modal, TabbedCard, PaymentSimulationModal } from '../shared';
import { peso } from '../data.ts';
import { motion } from 'framer-motion';
import { Tag, X, Check, ArrowRight, Sparkles, AlertTriangle } from 'lucide-react';
import { formatPromotionDate } from './promotionEligibility.ts';
import {
  computeDiscountedPrice,
  findRedeemablePromotion,
  formatPromotionDiscount,
  getActivePromotionsForMember,
  promotionAppliesToPlan,
  promotionMeetsMinSpend,
} from './promotionEligibility.ts';
import { buildCancelConfirmation, comparePlans, planDurationMonths } from './planComparison.ts';
import { createReceiptReference } from '../receipt.ts';
import { createSimulatedTransaction, getConfiguredPaymentFee, updateSimulatedTransaction } from '../payments.ts';

const PAYMENT_METHODS = [
  { value: 'GCash', label: 'GCash' },
  { value: 'Card', label: 'Credit / Debit Card' },
  { value: 'Cash', label: 'Cash on-site' },
];

function PlanComparisonTable({ currentPlan, plans, member, promotions, redemptions, asOf }) {
  return (
    <div className="plan-comparison" role="region" aria-label="Plan comparison">
      <div className="plan-comparison-head">
        <h3>Plan comparison</h3>
        <span>Side-by-side coverage, pricing, and what's different from your current plan.</span>
      </div>
      <div className="plan-comparison-table-wrap">
        <table className="plan-comparison-table">
          <thead>
            <tr>
              <th scope="col">Coverage</th>
              {plans.map((plan) => (
                <th key={plan.name} scope="col" className={plan.name === currentPlan?.name ? 'is-current' : ''}>
                  <div className="plan-comparison-head-cell">
                    <strong>{plan.name}</strong>
                    {plan.name === currentPlan?.name && <span className="plan-comparison-current-pill">Current</span>}
                    {plan.featured && plan.name !== currentPlan?.name && <span className="plan-comparison-popular-pill">Popular</span>}
                  </div>
                  <div className="plan-comparison-price">
                    {peso(plan.price)}<small>/{plan.period}</small>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Session limit / mo</th>
              {plans.map((plan) => (
                <td key={plan.name} className={plan.name === currentPlan?.name ? 'is-current' : ''}>
                  {plan.sessionLimit === 'unlimited' ? 'Unlimited' : `${plan.sessionLimit} sessions`}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Members on account</th>
              {plans.map((plan) => (
                <td key={plan.name} className={plan.name === currentPlan?.name ? 'is-current' : ''}>
                  {plan.members} {plan.members === 1 ? 'member' : 'members'}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Facilities</th>
              {plans.map((plan) => (
                <td key={plan.name} className={plan.name === currentPlan?.name ? 'is-current' : ''}>
                  <ul className="plan-comparison-bullets">
                    {plan.facilities.map((f) => <li key={f}><Check size={12} aria-hidden="true" /> {f}</li>)}
                  </ul>
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Included benefits</th>
              {plans.map((plan) => {
                const diff = currentPlan ? comparePlans(currentPlan, plan, member, promotions, redemptions, asOf) : null;
                return (
                  <td key={plan.name} className={plan.name === currentPlan?.name ? 'is-current' : ''}>
                    <ul className="plan-comparison-bullets">
                      {plan.includedBenefits.map((b) => {
                        const isShared = diff?.sharedBenefits.includes(b);
                        return (
                          <li key={b} className={isShared ? 'plan-comparison-bullet-shared' : 'plan-comparison-bullet-new'}>
                            <Check size={12} aria-hidden="true" /> {b}
                            {isShared ? <span className="plan-comparison-tag plan-comparison-tag-shared">Existing</span>
                                      : <span className="plan-comparison-tag plan-comparison-tag-new">New</span>}
                          </li>
                        );
                      })}
                    </ul>
                    {diff && diff.removedBenefits.length > 0 && (
                      <div className="plan-comparison-lost">
                        <span className="plan-comparison-lost-label">You'd lose:</span>
                        {diff.removedBenefits.map((b) => <span key={b} className="plan-comparison-tag plan-comparison-tag-lost">{b}</span>)}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
            <tr>
              <th scope="row">Not included</th>
              {plans.map((plan) => (
                <td key={plan.name} className={plan.name === currentPlan?.name ? 'is-current' : ''}>
                  {plan.excludedBenefits.length === 0
                    ? <span className="plan-comparison-muted">—</span>
                    : <ul className="plan-comparison-bullets plan-comparison-bullets-muted">
                        {plan.excludedBenefits.map((b) => <li key={b}><X size={12} aria-hidden="true" /> {b}</li>)}
                      </ul>}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Restrictions</th>
              {plans.map((plan) => {
                const diff = currentPlan ? comparePlans(currentPlan, plan, member, promotions, redemptions, asOf) : null;
                return (
                  <td key={plan.name} className={plan.name === currentPlan?.name ? 'is-current' : ''}>
                    <ul className="plan-comparison-bullets">
                      {plan.restrictions.map((r) => {
                        const isNew = diff?.newRestrictions.includes(r);
                        return (
                          <li key={r} className={isNew ? 'plan-comparison-bullet-new' : ''}>
                            <AlertTriangle size={12} aria-hidden="true" /> {r}
                            {isNew && <span className="plan-comparison-tag plan-comparison-tag-new">New</span>}
                          </li>
                        );
                      })}
                    </ul>
                  </td>
                );
              })}
            </tr>
            <tr>
              <th scope="row">Duration</th>
              {plans.map((plan) => {
                const months = planDurationMonths(plan);
                return (
                  <td key={plan.name} className={plan.name === currentPlan?.name ? 'is-current' : ''}>
                    {months} {months === 1 ? 'month' : 'months'} per cycle
                  </td>
                );
              })}
            </tr>
            <tr>
              <th scope="row">Active promo</th>
              {plans.map((plan) => {
                const diff = currentPlan ? comparePlans(currentPlan, plan, member, promotions, redemptions, asOf) : null;
                return (
                  <td key={plan.name} className={plan.name === currentPlan?.name ? 'is-current' : ''}>
                    {diff?.discount
                      ? <div className="plan-comparison-promo">
                          <strong className="mono">{diff.discount.promo.code}</strong>
                          <span>{formatPromotionDiscount(diff.discount.promo)}</span>
                          <span className="plan-comparison-savings">Save {peso(diff.discount.savings)}</span>
                        </div>
                      : <span className="plan-comparison-muted">No active discount</span>}
                  </td>
                );
              })}
            </tr>
            <tr>
              <th scope="row">Terms</th>
              {plans.map((plan) => (
                <td key={plan.name} className={plan.name === currentPlan?.name ? 'is-current' : ''}>
                  <span className="plan-comparison-terms">{plan.terms || '—'}</span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MemberMembership({
  members, setMembers, plans, promotions, promotionRedemptions, setPromotions, setPromotionRedemptions,
  setTransactions, currentUserId, today, toast, addAudit, preferredPaymentMethod = 'GCash',
}){
  const me = members.find(m => m.id === currentUserId) || members[0];
  const myRedemptions = useMemo(
    () => (promotionRedemptions || []).filter((r) => r.memberId === me?.id),
    [promotionRedemptions, me?.id],
  );
  const activePromotions = useMemo(
    () => getActivePromotionsForMember(promotions || [], myRedemptions, me),
    [promotions, myRedemptions, me?.plan],
  );

  const bestDiscountFor = (planName, basePrice) => {
    let best = null;
    const planPromotions = getActivePromotionsForMember(
      promotions || [],
      myRedemptions,
      me ? { id: me.id, plan: planName } : me,
      today || new Date(),
    );
    for (const promo of planPromotions) {
      if (!promotionAppliesToPlan(promo, planName)) continue;
      if (!promotionMeetsMinSpend(promo, basePrice)) continue;
      const discounted = computeDiscountedPrice(promo, basePrice);
      if (discounted === null || discounted >= basePrice) continue;
      if (!best || discounted < best.discountedPrice) {
        best = { promo, discountedPrice: discounted, savings: basePrice - discounted };
      }
    }
    return best;
  };

  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showChoose, setShowChoose] = useState(false);
  const [pickedPlan, setPickedPlan] = useState(me?.plan || 'Premium');
  const [method, setMethod] = useState(preferredPaymentMethod);
  const [paymentFlow, setPaymentFlow] = useState(null);
  const [codeInput, setCodeInput] = useState('');
  const [redemptionStatus, setRedemptionStatus] = useState(null);

  const [showVerify, setShowVerify] = useState(false);
  const [verifyStep, setVerifyStep] = useState(1);
  const [idPreview, setIdPreview] = useState(null);
  const [formPreview, setFormPreview] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState('None');

  const expiryDate = me?.membershipValidUntil ? new Date(`${me.membershipValidUntil.slice(0, 10)}T00:00:00`) : null;
  const remainingDays = expiryDate && !Number.isNaN(expiryDate.getTime())
    ? Math.ceil((expiryDate.getTime() - new Date(new Date().toDateString()).getTime()) / 86400000)
    : null;
  const validitySummary = remainingDays === null ? 'Validity not recorded'
    : remainingDays < 0 ? `Expired ${Math.abs(remainingDays)} day${Math.abs(remainingDays) === 1 ? '' : 's'} ago`
    : remainingDays === 0 ? 'Expires today'
    : `${remainingDays} day${remainingDays === 1 ? '' : 's'} remaining`;

  const currentPlan = plans.find(p => p.name === me?.plan);
  const currentDiscount = currentPlan ? bestDiscountFor(currentPlan.name, currentPlan.price) : null;
  const currentPriceToPay = currentDiscount ? currentDiscount.discountedPrice : (currentPlan?.price || 0);
  const isFrozen = me?.status === 'Frozen';

  const handleRedeemPromotion = (event) => {
    event?.preventDefault?.();
    const { promotion, error } = findRedeemablePromotion(
      promotions || [],
      myRedemptions,
      me ? { id: me.id, plan: pickedPlan } : me,
      codeInput,
      today || new Date(),
    );
    if (!promotion) {
      setRedemptionStatus({ type: 'error', message: error || 'Invalid promotion code' });
      return;
    }

    setPromotions((previous) => previous.map((item) => item.id === promotion.id
      ? { ...item, redemptions: Number(item.redemptions || 0) + 1 }
      : item));
    setPromotionRedemptions((previous) => [
      ...previous,
      {
        id: `PR-${Date.now()}`,
        memberId: me.id,
        promotionId: promotion.id,
        code: promotion.code,
        redeemedAt: new Date().toISOString(),
      },
    ]);
    setRedemptionStatus({
      type: 'success',
      message: `${promotion.title} unlocked — ${formatPromotionDiscount(promotion)} on eligible plans and trainer sessions.`,
    });
    setCodeInput('');
    toast(`Promotion ${promotion.code} redeemed`);
  };

  const beginPayment = ({ type, amount, onSuccess }) => {
    const fees = getConfiguredPaymentFee(method, amount);
    const transaction = createSimulatedTransaction({
      member: me.name,
      type,
      amount,
      method,
      date: today,
      fees,
    });
    setTransactions(prev => [transaction, ...prev]);
    setPaymentFlow({ transactionId: transaction.id, method, amount, fees, onSuccess });
  };

  const updatePaymentState = (paymentState) => {
    setTransactions(prev => prev.map(transaction => {
      if (transaction.id !== paymentFlow?.transactionId) return transaction;
      return updateSimulatedTransaction(transaction, paymentState);
    }));
  };

  const completePayment = (paymentState) => {
    if (paymentState !== 'Successful') {
      toast('Simulated payment failed. Membership was not changed.');
      return;
    }
    paymentFlow?.onSuccess();
    addAudit?.('info', 'Simulated payment successful', paymentFlow?.transactionId);
  };

  const closePayment = () => {
    setPaymentFlow(null);
  };

  // Renewal is preserved on the current-plan card and inside the "Choose plan" modal,
  // so members can still extend their plan without a dedicated "Switch Plan" button.
  const renew = () => {
    const plan = currentPlan;
    if (!plan) return;
    const baseDate = expiryDate && remainingDays !== null && remainingDays >= 0 ? expiryDate : new Date();
    const monthsToAdd = planDurationMonths(plan);
    const nextExpiry = new Date(baseDate);
    const originalDay = nextExpiry.getDate();
    nextExpiry.setDate(1);
    nextExpiry.setMonth(nextExpiry.getMonth() + monthsToAdd);
    nextExpiry.setDate(Math.min(originalDay, new Date(nextExpiry.getFullYear(), nextExpiry.getMonth() + 1, 0).getDate()));
    const membershipValidUntil = `${nextExpiry.getFullYear()}-${String(nextExpiry.getMonth() + 1).padStart(2, '0')}-${String(nextExpiry.getDate()).padStart(2, '0')}`;
    const discount = currentDiscount;
    const amount = discount ? discount.discountedPrice : plan.price;
    const txnType = `Membership Renewal (${me.plan})` + (discount ? ` · code ${discount.promo.code}` : '');
    beginPayment({
      type: txnType,
      amount,
      onSuccess: () => {
        setMembers(prev => prev.map(member => member.id === me.id ? { ...member, membershipValidUntil, status: 'Active' } : member));
        addAudit?.('info', 'Membership renewed', `${me.plan}${discount ? ` · code ${discount.promo.code}` : ''}`);
        toast(
          discount
            ? `Membership renewed through ${formatPromotionDate(membershipValidUntil)} — saved ${peso(discount.savings)} with ${discount.promo.code}`
            : `Membership renewed through ${formatPromotionDate(membershipValidUntil)}`,
        );
      },
    });
  };

  const choosePlan = (e) => {
    e?.preventDefault?.();
    if (pickedPlan === me.plan) { toast('That is already your current plan'); setShowChoose(false); return; }
    if (pickedPlan.toLowerCase().includes('student') && verificationStatus !== 'Verified') {
      setShowVerify(true); setShowChoose(false); return;
    }
    const newPlan = plans.find(p => p.name === pickedPlan);
    if (!newPlan) return;
    const discount = bestDiscountFor(newPlan.name, newPlan.price);
    const amount = discount ? discount.discountedPrice : newPlan.price;
    const monthsToAdd = planDurationMonths(newPlan);
    const baseDate = new Date();
    const nextExpiry = new Date(baseDate);
    nextExpiry.setDate(1);
    nextExpiry.setMonth(nextExpiry.getMonth() + monthsToAdd);
    nextExpiry.setDate(Math.min(nextExpiry.getDate(), new Date(nextExpiry.getFullYear(), nextExpiry.getMonth() + 1, 0).getDate()));
    const membershipValidUntil = `${nextExpiry.getFullYear()}-${String(nextExpiry.getMonth() + 1).padStart(2, '0')}-${String(nextExpiry.getDate()).padStart(2, '0')}`;
    const txnType = `Plan Change → ${pickedPlan}` + (discount ? ` · code ${discount.promo.code}` : '');
    setShowChoose(false);
    beginPayment({
      type: txnType,
      amount,
      onSuccess: () => {
        setMembers(prev => prev.map(m => m.id === me.id ? { ...m, plan: pickedPlan, membershipValidUntil, status: 'Active' } : m));
        addAudit?.('info', 'Plan changed', `${me.plan} → ${pickedPlan}${discount ? ` · code ${discount.promo.code}` : ''}`);
        toast(
          discount
            ? `Switched to ${pickedPlan} — saved ${peso(discount.savings)} with ${discount.promo.code}`
            : `Switched to ${pickedPlan} plan`,
        );
      },
    });
  };

  const confirmCancel = () => {
    const conf = buildCancelConfirmation(me, currentPlan, { reason: cancelReason });
    addAudit?.('warn', 'Plan cancellation requested', `${conf.planName} · ${conf.reason}`);
    setMembers(prev => prev.map(m => m.id === me.id ? { ...m, status: 'Expired' } : m));
    const receiptNumber = createReceiptReference();
    setTransactions(prev => [{
      id: 'TXN-' + (8821 + prev.length),
      receiptNumber,
      member: me.name,
      type: `Plan Cancellation (${conf.planName})`,
      amount: 0,
      method,
      date: today,
      status: 'Refunded',
    }, ...prev]);
    toast(`Plan cancellation submitted for ${conf.planName}. An admin will confirm.`);
    setShowCancel(false);
    setCancelReason('');
  };

  const handleFileUpload = (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === 'id') setIdPreview(reader.result);
      else setFormPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const submitVerification = () => {
    setVerificationStatus('Pending');
    toast('Documents submitted. Pending admin review.');
    setShowVerify(false);
  };

  const planOptions = useMemo(() => (plans || []).map((p) => ({
    value: p.name,
    label: p.name,
    description: `${peso(p.price)} / ${p.period} · ${p.sessionLimit === 'unlimited' ? 'Unlimited' : `${p.sessionLimit} sessions`} / mo`,
    badge: p.name === currentPlan?.name ? 'Current' : (p.featured ? 'Popular' : undefined),
  })), [plans, currentPlan]);

  const paymentOptions = useMemo(() => PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label })), []);

  const newPlan = plans.find((p) => p.name === pickedPlan);
  const chooseDiscount = newPlan ? bestDiscountFor(newPlan.name, newPlan.price) : null;
  const choosePrice = chooseDiscount ? chooseDiscount.discountedPrice : (newPlan?.price || 0);

  return (
    <>
      <section className="member-current-plan card" aria-labelledby="member-plan-heading">
        <div className="member-current-plan-main">
          <div className="eyebrow">Current membership</div>
          <h2 id="member-plan-heading">{me?.plan || 'No plan selected'}</h2>
          <p>{validitySummary}{expiryDate && !Number.isNaN(expiryDate.getTime()) ? ` · valid through ${formatPromotionDate(me.membershipValidUntil)}` : ''}</p>
          {currentPlan?.description && <p className="member-current-plan-desc">{currentPlan.description}</p>}
        </div>
        <div className="member-current-plan-meta">
          <Badge status={me?.status || 'Active'} />
          <span className="member-plan-price">
            {currentDiscount
              ? <span className="price-with-discount"><s className="member-plan-price-old">{peso(currentPlan.price)}</s><strong>{peso(currentPriceToPay)}</strong><span className="member-plan-price-saved">Save {peso(currentDiscount.savings)}</span></span>
              : `${peso(currentPlan?.price || 0)} / mo`}
          </span>
          {currentDiscount && <span className="member-plan-price-code mono">Code {currentDiscount.promo.code}</span>}
          {verificationStatus !== 'None' && <Badge status={verificationStatus === 'Verified' ? 'Active' : 'Pending'}>Student: {verificationStatus}</Badge>}
        </div>
        {isFrozen && <div className="member-frozen-note">Your membership is frozen. Cancellation and plan changes are paused until an admin unfreezes your account.</div>}
        <div className="member-current-plan-actions">
          <button className="btn btn-signal btn-sm" onClick={renew} disabled={isFrozen}>Renew at current terms</button>
          <button className="btn btn-outline btn-sm" onClick={() => setShowCancel(true)} disabled={isFrozen}>Cancel Plan</button>
        </div>
      </section>

      {activePromotions.length > 0 && (
        <div className="member-promo-active" aria-label="Your active discounts">
          <div className="member-promo-active-head">
            <h3><Sparkles size={16} aria-hidden="true" /> Your active discounts</h3>
            <span>These apply automatically to eligible plans and trainer sessions.</span>
          </div>
          <ul className="member-promo-active-list">
            {activePromotions.map((promo) => (
              <li key={promo.id} className="member-promo-active-item">
                <div className="member-promo-active-main">
                  <strong>{promo.title}</strong>
                  <span className="member-promo-discount">{formatPromotionDiscount(promo)}</span>
                </div>
                <div className="member-promo-active-meta">
                  <span>Code <strong className="mono">{promo.code}</strong></span>
                  <span>Valid through {formatPromotionDate(promo.validUntil)}</span>
                  <span>Applies to: {promotionAppliesToPlan(promo, 'Any') ? 'All membership plans and trainer sessions' : `${promo.plan} plan`}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <TabbedCard label="Plans" title="Available plans">
        <p className="muted" style={{margin:'0 0 14px', fontSize:13.5}}>Choose a plan to compare against your current coverage. All prices and benefits are loaded from the plans database.</p>
        <div className="grid grid-3" role="list">
          {plans.map((p) => {
            const isCurrent = p.name === me?.plan;
            const discount = bestDiscountFor(p.name, p.price);
            return (
              <div role="listitem" className={"plan-card" + (p.featured ? ' featured' : '') + (isCurrent ? ' is-current' : '')} key={p.name}>
                {p.featured && !isCurrent && <span className="ribbon">Popular</span>}
                {isCurrent && <span className="ribbon ribbon-current">Current</span>}
                <h3 style={{fontSize:19.8}}>{p.name}</h3>
                <p className="plan-card-desc">{p.description}</p>
                {discount ? (
                  <div className="price price-with-discount">
                    <s className="member-plan-price-old">{peso(p.price)}</s>
                    <strong>{peso(discount.discountedPrice)}</strong>
                    <span className="member-plan-price-period">/{p.period}</span>
                    <span className="member-plan-price-saved">Save {peso(discount.savings)}</span>
                  </div>
                ) : (
                  <div className="price">{peso(p.price)}<span>/{p.period}</span></div>
                )}
                {discount && <div className="member-plan-price-code mono">with code {discount.promo.code}</div>}
                <ul className="plan-card-perks">{p.perks.map((perk, i) => <li key={i}><Check size={12} aria-hidden="true" /> {perk}</li>)}</ul>
                <div className="plan-card-meta">
                  <span><strong>{p.sessionLimit === 'unlimited' ? 'Unlimited' : p.sessionLimit}</strong> sessions / mo</span>
                  <span>{p.members} {p.members === 1 ? 'member' : 'members'}</span>
                </div>
                <button
                  className={"btn btn-sm btn-block " + (isCurrent ? 'btn-outline' : 'btn-signal')}
                  disabled={isCurrent}
                  onClick={() => { setPickedPlan(p.name); setShowChoose(true); }}
                >
                  {isCurrent ? 'Current plan' : <><span>Choose {p.name}</span> <ArrowRight size={14} aria-hidden="true" /></>}
                </button>
              </div>
            );
          })}
        </div>
      </TabbedCard>

      {currentPlan && (
        <PlanComparisonTable
          currentPlan={currentPlan}
          plans={plans}
          member={me}
          promotions={promotions}
          redemptions={myRedemptions}
          asOf={new Date()}
        />
      )}

      {showChoose && newPlan && (
        <Modal title={newPlan.name === me.plan ? 'Renew membership' : `Choose ${newPlan.name}`} onClose={() => setShowChoose(false)}>
          <div>
            <p style={{fontSize:14, color:'var(--steel)', marginBottom:12}}>{newPlan.description}</p>
            <form onSubmit={choosePlan}>
              {chooseDiscount && (
                <div className="member-renew-savings">
                  <span>Code <strong className="mono">{chooseDiscount.promo.code}</strong> is active.</span>
                  <span>Price: <s>{peso(newPlan.price)}</s> <strong>{peso(choosePrice)}</strong> · save {peso(chooseDiscount.savings)}</span>
                </div>
              )}
              <Field label="Plan">
                <Dropdown
                  value={pickedPlan}
                  onChange={setPickedPlan}
                  options={planOptions}
                  ariaLabel="Select a plan"
                  fullWidth
                />
              </Field>
              <Field label="Payment method">
                <Dropdown
                  value={method}
                  onChange={setMethod}
                  options={paymentOptions}
                  ariaLabel="Select a payment method"
                  fullWidth
                />
              </Field>
              <div className="member-promo-redeem-box" aria-label="Redeem a promotion code for this plan">
                <div className="member-promo-redeem-intro">
                  <Tag size={18} aria-hidden="true" />
                  <div>
                    <strong>Have a promotion code?</strong>
                    <span>Redeem a code for the {newPlan.name} plan before confirming.</span>
                  </div>
                </div>
                <div className="member-promo-redeem-controls">
                  <input
                    type="text"
                    className="form-control mono"
                    placeholder="Enter promotion code"
                    value={codeInput}
                    onChange={(event) => { setCodeInput(event.target.value); setRedemptionStatus(null); }}
                    aria-label="Promotion code"
                  />
                  <button type="button" className="btn btn-signal" onClick={handleRedeemPromotion} disabled={!codeInput.trim()}>
                    Redeem
                  </button>
                </div>
                {redemptionStatus && (
                  <div
                    className="member-promo-redeem-status"
                    role="status"
                    aria-live="polite"
                    style={{
                      backgroundColor: redemptionStatus.type === 'success' ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)',
                      color: redemptionStatus.type === 'success' ? 'rgb(40, 167, 69)' : 'rgb(220, 53, 69)',
                    }}
                  >
                    {redemptionStatus.message}
                  </div>
                )}
              </div>
              <button type="submit" className="btn btn-signal btn-block">
                {newPlan.name === me.plan
                  ? <>Confirm renewal — {chooseDiscount ? <><s style={{opacity:.6, marginRight:6}}>{peso(newPlan.price)}</s>{peso(choosePrice)}</> : peso(newPlan.price)}</>
                  : `Confirm plan change — ${chooseDiscount ? peso(choosePrice) : peso(newPlan.price)}`}
              </button>
            </form>
          </div>
        </Modal>
      )}

      {showCancel && currentPlan && (
        <Modal title="Cancel plan" onClose={() => setShowCancel(false)}>
          <div className="cancel-confirmation">
            <div className="cancel-confirmation-banner">
              <AlertTriangle size={18} aria-hidden="true" />
              <div>
                <strong>This will cancel your {currentPlan.name} membership.</strong>
                <span>You'll keep access through the end of your current billing period, then your plan moves to <b>Expired</b>. You can re-pick any plan from the comparison below.</span>
              </div>
            </div>
            <Field label="Reason for cancellation (optional)">
              <textarea
                className="form-control"
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Moving, too expensive, need different schedule…"
              />
            </Field>
            <Field label="Payment method on file (for any prorated refund)">
              <Dropdown
                value={method}
                onChange={setMethod}
                options={paymentOptions}
                ariaLabel="Payment method on file"
                fullWidth
              />
            </Field>
            <div className="cancel-confirmation-actions">
              <button type="button" className="btn btn-outline" onClick={() => setShowCancel(false)}>Keep plan</button>
              <button type="button" className="btn btn-danger" onClick={confirmCancel}>Confirm cancellation</button>
            </div>
            <p className="cancel-confirmation-note">
              This is a plan cancellation, not a payment-method change. Switching how you pay is handled separately.
            </p>
          </div>
        </Modal>
      )}

      {showVerify && (
        <Modal title="Student Discount Verification" onClose={() => setShowVerify(false)}>
          <div style={{padding: '0 24px 24px'}}>
            <div style={{display:'flex', gap:8, marginBottom:20}}>
              {[1,2,3].map(s => (
                <div key={s} style={{
                  flex:1, height:4, borderRadius:2,
                  backgroundColor: s <= verifyStep ? 'var(--signal)' : 'var(--line)'
                }} />
              ))}
            </div>

            {verifyStep === 1 && (
              <motion.div initial={{opacity:0}} animate={{opacity:1}}>
                <p style={{fontSize:15.4, color:'var(--steel)', marginBottom:16, lineHeight:1.5}}>Please upload a clear photo of your <b style={{color:'var(--ink)'}}>Student ID</b>.</p>
                <Field label="Student ID Image">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => handleFileUpload(e, 'id')}
                    style={{ fontSize: 17.6, padding: '8px', cursor: 'pointer', width: '100%' }}
                  />
                </Field>
                {idPreview && <img src={idPreview} style={{width:'100%', maxHeight:200, objectFit:'contain', borderRadius:8, marginTop:12, border:'1px solid var(--line)'}} />}
                <button className="btn btn-signal btn-block" style={{marginTop:24, height: 48, fontSize: 17.6}} onClick={()=>setVerifyStep(2)} disabled={!idPreview}>Next Step</button>
              </motion.div>
            )}

            {verifyStep === 2 && (
              <motion.div initial={{opacity:0}} animate={{opacity:1}}>
                <p style={{fontSize:15.4, color:'var(--steel)', marginBottom:16, lineHeight:1.5}}>Upload your <b style={{color:'var(--ink)'}}>Registration Form</b> or Certificate of Enrollment (PDF/Image).</p>
                <Field label="Registration Document">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={e => handleFileUpload(e, 'form')}
                    style={{ fontSize: 17.6, padding: '8px', cursor: 'pointer', width: '100%' }}
                  />
                </Field>
                {formPreview && <div style={{marginTop:12, padding:8, background:'var(--surface-2)', borderRadius:8, fontSize:14.3, textAlign:'center', border:'1px solid var(--line)'}}>
                  {formPreview.startsWith('data:application/pdf') ? 'PDF Document Uploaded' : <img src={formPreview} style={{width:'100%', maxHeight:200, objectFit:'contain'}} />}
                </div>}
                <div style={{display:'flex', gap:12, marginTop:24}}>
                  <button className="btn btn-outline btn-block" style={{height: 48, fontSize: 17.6}} onClick={()=>setVerifyStep(1)}>Back</button>
                  <button className="btn btn-signal btn-block" style={{height: 48, fontSize: 17.6}} onClick={()=>setVerifyStep(3)} disabled={!formPreview}>Next Step</button>
                </div>
              </motion.div>
            )}

            {verifyStep === 3 && (
              <motion.div initial={{opacity:0}} animate={{opacity:1}} style={{textAlign:'center'}}>
                <div style={{fontSize:52.8, marginBottom:16}}>📝</div>
                <h3 style={{marginBottom:12, fontSize: 22}}>Review Your Documents</h3>
                <p style={{fontSize:15.4, color:'var(--steel)', marginBottom:24, lineHeight:1.5}}>Our team will review your student credentials. You will be notified once verified.</p>
                <div style={{display:'flex', gap:12, justifyContent:'center'}}>
                  <button className="btn btn-outline" style={{height: 48, fontSize: 17.6, padding: '0 24px'}} onClick={()=>setVerifyStep(2)}>Back</button>
                  <button className="btn btn-signal" style={{height: 48, fontSize: 17.6, padding: '0 24px'}} onClick={submitVerification}>Submit for Review</button>
                </div>
              </motion.div>
            )}
          </div>
        </Modal>
      )}
      {paymentFlow && (
        <PaymentSimulationModal
          method={paymentFlow.method}
          amount={paymentFlow.amount}
          fees={paymentFlow.fees}
          onStateChange={updatePaymentState}
          onComplete={completePayment}
          onClose={closePayment}
        />
      )}
    </>
  );
}

export default MemberMembership;