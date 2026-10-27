import { useMemo, useState } from 'react';
import { Search, ShoppingCart, Trash2, UserRound } from 'lucide-react';
import { TabbedCard, Field, Select } from '../shared';
import { formatMoney as peso } from '../shared/utils/money';
import { calculatePosPricing, type TaxMode } from './posPricing';
import { createReceiptReference } from '../receipt';
import { getConfiguredPaymentFee } from '../payments';
import type { Member, Plan, Transaction } from '../types.ts';
import StaffCashPaymentModal from './StaffCashPaymentModal';
import StaffGcashSimulationModal from './StaffGcashSimulationModal';

interface StaffPOSProps {
  members: Member[];
  plans: Plan[];
  toast: (message: string) => void;
  preferredPaymentMethod?: string;
  onStaffSale?: (input: { reference: string; memberId: string; planNames: string[];
    method: 'Cash' | 'GCash'; taxRate: string; taxMode: TaxMode; cashReceived?: number }) => Promise<Transaction>;
}

interface POSCartItem {
  id: string;
  name: string;
  planName: string;
  price: number;
}

interface CheckoutPayment {
  reference: string;
  method: 'Cash' | 'GCash';
  amount: number;
  fees: number;
  memberId: string;
  planNames: string[];
  taxRate: string;
  taxMode: TaxMode;
}

function StaffPOS({ members, plans, toast, onStaffSale }: StaffPOSProps) {
  const [cart, setCart] = useState<POSCartItem[]>([]);
  const [method, setMethod] = useState<'Cash' | 'GCash'>('Cash');
  const [memberId, setMemberId] = useState(members.find((member) => !member.deletedAt)?.id || '');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberStatus, setMemberStatus] = useState('All');
  const [payment, setPayment] = useState<CheckoutPayment | null>(null);

  const items = useMemo(
    () => (plans || [])
      .filter((plan) => plan.status !== 'Inactive')
      .map((plan) => ({ id: `PLAN-${plan.name}`, name: `${plan.name} Membership`, planName: plan.name, price: Number(plan.price) })),
    [plans],
  );
  const total = cart.reduce((sum, item) => sum + item.price, 0);
  const [taxRate, setTaxRate] = useState('');
  const [taxMode, setTaxMode] = useState<TaxMode>('exclusive');
  const pricing = useMemo(() => {
    try { return { ...calculatePosPricing(total, taxRate, taxMode), error: '' }; }
    catch (cause) { return { ...calculatePosPricing(total, '', taxMode), error: cause instanceof Error ? cause.message : 'Check the tax settings.' }; }
  }, [total, taxRate, taxMode]);
  const feeResult = useMemo(() => {
    try { return { fees: getConfiguredPaymentFee(method, pricing.total), error: '' }; }
    catch (cause) { return { fees: 0, error: cause instanceof Error ? cause.message : 'Check the payment fee.' }; }
  }, [method, pricing.total]);
  const { fees, error: feeError } = feeResult;
  const member = members.find((entry) => entry.id === memberId && !entry.deletedAt) || null;
  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLocaleLowerCase();
    return (members || [])
      .filter((entry) => !entry.deletedAt)
      .filter((entry) => memberStatus === 'All' || entry.status === memberStatus)
      .filter((entry) => !query || [entry.name, entry.id, entry.email, entry.phone, entry.plan]
        .some((value) => String(value || '').toLocaleLowerCase().includes(query)))
      .slice(0, 8);
  }, [members, memberSearch, memberStatus]);

  const isPtItem = (item: { planName: string; name: string }) =>
  /pt|personal training|trainer/i.test(item.planName + ' ' + item.name);
const addPlan = (item: POSCartItem) => {
    if (cart.some((entry) => entry.id === item.id)) {
      toast(`${item.planName} is already in the cart.`);
      return;
    }
    const existingMembership = cart.find((entry) => !isPtItem(entry));
    const addingMembership = !isPtItem(item);
    if (existingMembership && addingMembership) {
      toast('Only one membership plan can be selected per sale. Remove the current plan before adding another.');
      return;
    }
    setCart((previous) => [...previous, item]);
  };

  const charge = () => {
    if (!onStaffSale) { toast('Point of Sale is unavailable. Please retry.'); return; }
    if (cart.length === 0) { toast('Cart is empty'); return; }
    if (!cart.every((item) => items.some((available) => available.id === item.id && available.price === item.price))) {
      toast('A plan in the cart is no longer available. Review the cart before checkout.');
      return;
    }
    if (memberId && !member) { toast('Select an active member or choose walk-in customer.'); return; }
    if (pricing.error || feeError) { toast(pricing.error || feeError); return; }
    const receipt = createReceiptReference();
    setPayment({ reference: `PAY-${receipt.slice(3)}`, method, amount: pricing.total, fees,
      memberId, planNames: cart.map((item) => item.planName), taxRate, taxMode });
  };

  const confirmCash = async (cashReceived: number) => {
    if (!onStaffSale || !payment) throw new Error('The sale is no longer available.');
    const transaction = await onStaffSale({ reference: payment.reference, memberId: payment.memberId,
      planNames: payment.planNames, method: 'Cash', taxRate: payment.taxRate,
      taxMode: payment.taxMode, cashReceived });
    setCart([]);
    toast('Cash payment recorded.');
    return transaction;
  };

  const simulateGcash = async () => {
    if (!onStaffSale || !payment) throw new Error('The sale is no longer available.');
    const transaction = await onStaffSale({ reference: payment.reference, memberId: payment.memberId,
      planNames: payment.planNames, method: 'GCash', taxRate: payment.taxRate, taxMode: payment.taxMode });
    setCart([]);
    toast('GCash test payment recorded. No real payment was collected.');
    return transaction;
  };

  return (
    <>
      <div className="grid grid-2-1 staff-pos">
        <TabbedCard title="Membership Plans">
          <p className="staff-pos-hint">Select one membership plan per sale. Remove it to choose a different plan.</p>
          <div className="staff-pos-products">
            {items.map((item) => {
              const inCart = cart.some((entry) => entry.id === item.id);
              const incompatible = !isPtItem(item) && cart.some(entry => !isPtItem(entry)) && !inCart;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`card pos-item${inCart ? ' is-in-cart' : ''}`}
                  onClick={() => addPlan(item)}
                  disabled={inCart || incompatible}
                  title={incompatible ? "Remove the current membership plan to choose this one." : undefined}
                  aria-pressed={inCart}
                >
                  <span className="staff-pos-plan-name">{item.name}</span>
                  <span className="staff-pos-plan-price">{peso(item.price)}</span>
                  <span className="staff-pos-plan-action">{inCart ? 'Added to cart' : incompatible ? 'Remove selected plan first' : 'Add to cart'}</span>
                </button>
              );
            })}
            {items.length === 0 && <div className="empty-state">No active plans are available to sell.</div>}
          </div>
        </TabbedCard>

        <TabbedCard
          title="Sale Summary"
          right={cart.length > 0 ? (
            <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => setCart([])}>
              Clear All
            </button>
          ) : null}
        >
          <div className="staff-pos-member-search">
            <Field label="Find member">
              <div className="staff-pos-search-control">
                <Search size={17} aria-hidden="true" />
                <input
                  className="form-control"
                  type="search"
                  value={memberSearch}
                  onChange={(event) => setMemberSearch(event.target.value)}
                  placeholder="Name, member ID, email, or phone"
                  aria-label="Search members by name, member ID, email, phone, or plan"
                />
              </div>
            </Field>
            <Field label="Status filter">
              <Select value={memberStatus} onChange={setMemberStatus} aria-label="Filter members by status">
                {['All', 'Active', 'Expiring', 'Frozen', 'Expired'].map((status) => (
                  <option key={status} value={status}>{status === 'Expiring' ? 'Expire' : status}</option>
                ))}
              </Select>
            </Field>
            <div className="staff-pos-member-results" role="listbox" aria-label="Matching members">
              <button
                type="button"
                className={`staff-pos-member-option${!memberId ? ' selected' : ''}`}
                role="option"
                aria-selected={!memberId}
                onClick={() => setMemberId('')}
              >
                <UserRound size={16} aria-hidden="true" />
                <span><strong>Walk-in customer</strong><small>No membership account</small></span>
              </button>
              {filteredMembers.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={`staff-pos-member-option${memberId === entry.id ? ' selected' : ''}`}
                  role="option"
                  aria-selected={memberId === entry.id}
                  onClick={() => setMemberId(entry.id)}
                >
                  <UserRound size={16} aria-hidden="true" />
                  <span>
                    <strong>{entry.name}</strong>
                    <small>{entry.id} · {entry.plan} · {entry.status}</small>
                  </span>
                </button>
              ))}
              {filteredMembers.length === 0 && (
                <p className="staff-pos-no-members">No members match this search and filter.</p>
              )}
            </div>
            {member && (
              <div className="staff-pos-member-detail">
                <strong>{member.name}</strong>
                <span>{member.email} · {member.phone || 'No phone on file'}</span>
                <span>Current plan: {member.plan} · Status: {member.status}</span>
              </div>
            )}
          </div>

          <Field label="Payment method">
            <Select value={method} onChange={(value) => setMethod(value as 'Cash' | 'GCash')} aria-label="Payment method">
              <option value="Cash">Cash</option><option value="GCash">GCash (simulation)</option>
            </Select>
          </Field>

          <details className="pos-tax-settings"><summary>Tax settings</summary>
            <p>Use the gym’s approved rate and pricing treatment. Leave the rate blank to preserve current prices.</p>
            <Field label="VAT / tax rate (%)"><input className="form-control" type="number" min="0" max="100" step="0.01" value={taxRate} onChange={event => setTaxRate(event.target.value)} aria-label="VAT or tax rate" placeholder="Not configured" /></Field>
            <Field label="Price treatment"><Select value={taxMode} onChange={value => setTaxMode(value as TaxMode)} aria-label="Tax treatment"><option value="exclusive">Add tax to item prices</option><option value="inclusive">Item prices already include tax</option></Select></Field>
            {pricing.error && <p className="field-error" role="alert">{pricing.error}</p>}
          </details>
          <section className="staff-pos-cart" aria-label="Cart items">
            <div className="staff-pos-cart-head">
              <h3><ShoppingCart size={16} aria-hidden="true" /> Items</h3>
              <span>{cart.length} {cart.length === 1 ? 'item' : 'items'}</span>
            </div>
            {cart.length === 0 ? (
              <p className="staff-pos-cart-empty">Cart is empty. Choose a membership plan to add it.</p>
            ) : (
              <ul className="staff-pos-cart-list">
                {cart.map((item) => (
                  <li key={item.id}>
                    <span><strong>{item.name}</strong><small>One plan per sale</small></span>
                    <strong>{peso(item.price)}</strong>
                    <button
                      type="button"
                      className="staff-pos-remove"
                      onClick={() => setCart((previous) => previous.filter((entry) => entry.id !== item.id))}
                      aria-label={`Remove ${item.name} from cart`}
                      title={`Remove ${item.name}`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="staff-pos-totals">
              <div><span>Subtotal</span><strong>{peso(total)}</strong></div>
              {pricing.configured ? <>
                {taxMode === 'inclusive' && <div><span>Taxable amount</span><strong>{peso(pricing.base)}</strong></div>}
                <div><span>VAT / tax ({pricing.rate}%{taxMode === 'inclusive' ? ', included' : ''})</span><strong>{peso(pricing.tax)}</strong></div>
              </> : <div><span>VAT / tax</span><span>Not configured</span></div>}
              {fees > 0 && <div><span>Payment fee</span><strong>{peso(fees)}</strong></div>}
              <div className="staff-pos-grand-total"><span>Total</span><strong>{peso(pricing.total + fees)}</strong></div>
            </div>
            {feeError && <p className="staff-pos-fee-error" role="alert">{feeError}</p>}
          </section>

          <button
            type="button"
            className="btn btn-signal btn-block staff-pos-charge"
            onClick={charge}
            disabled={cart.length === 0 || Boolean(pricing.error || feeError)}
          >
            {method === 'Cash' ? 'Charge' : 'Simulate'} {peso(pricing.total + fees)}
          </button>
        </TabbedCard>
      </div>
      {payment?.method === 'Cash' && <StaffCashPaymentModal
        amount={payment.amount}
        onConfirm={confirmCash}
        onClose={() => setPayment(null)}
      />}
      {payment?.method === 'GCash' && <StaffGcashSimulationModal
        amount={payment.amount}
        fees={payment.fees}
        onSimulate={simulateGcash}
        onClose={() => setPayment(null)}
      />}
    </>
  );
}

export default StaffPOS;
