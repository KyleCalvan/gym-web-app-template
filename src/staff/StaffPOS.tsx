import { useMemo, useState } from 'react';
import { Search, ShoppingCart, Trash2, UserRound } from 'lucide-react';
import { TabbedCard, Field, Select, PaymentSimulationModal } from '../shared';
import { peso } from '../data.ts';
import { getConfiguredPaymentFee } from '../payments.ts';
import { createOrder, payOrder, resolveGymUserId, type OrderLineInput } from '../lib/api-client.ts';
import type { Member, PaymentState, Plan, Setter, Transaction } from '../types.ts';

interface StaffPOSProps {
  setTransactions: Setter<Transaction[]>;
  members: Member[];
  plans: Plan[];
  toast: (message: string) => void;
  preferredPaymentMethod?: string;
}

interface POSCartItem {
  id: string;
  name: string;
  planName: string;
  price: number;
}

interface POSPayment {
  transactionId: string;
  method: string;
  amount: number;
  fees: number;
}

function StaffPOS({ setTransactions, members, plans, toast, preferredPaymentMethod = 'GCash' }: StaffPOSProps) {
  const [cart, setCart] = useState<POSCartItem[]>([]);
  const [method, setMethod] = useState(preferredPaymentMethod);
  const [memberId, setMemberId] = useState(members.find((member) => !member.deletedAt)?.id || '');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberStatus, setMemberStatus] = useState('All');
  const [payment, setPayment] = useState<POSPayment | null>(null);
  const [charging, setCharging] = useState(false);

  const items = useMemo(
    () => (plans || [])
      .filter((plan) => plan.status !== 'Inactive')
      .map((plan) => ({ id: `PLAN-${plan.name}`, name: `${plan.name} Membership`, planName: plan.name, price: Number(plan.price) })),
    [plans],
  );
  const total = cart.reduce((sum, item) => sum + item.price, 0);
  const feeResult = useMemo(() => {
    try {
      return { fees: getConfiguredPaymentFee(method, total), error: '' };
    } catch (error) {
      return {
        fees: 0,
        error: error instanceof Error ? error.message : 'Configured payment fee is invalid.',
      };
    }
  }, [method, total]);
  const fees = feeResult.fees;
  const feeError = feeResult.error;
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

  const charge = async () => {
    if (cart.length === 0) { toast('Cart is empty'); return; }
    if (!cart.every((item) => items.some((available) => available.id === item.id && available.price === item.price))) {
      toast('A plan in the cart is no longer available. Review the cart before checkout.');
      return;
    }
    if (memberId && !member) { toast('Select an active member or choose walk-in customer.'); return; }
    if (feeError) { toast(feeError); return; }
    if (charging) return;
    setCharging(true);

    try {
      const gymUserId = memberId ? await resolveGymUserId(memberId) : null;

      const lines: OrderLineInput[] = cart.map((item) => ({
        itemType: isPtItem(item) ? 'PTSession' : 'Membership',
        itemName: item.name,
        description: item.planName,
        quantity: 1,
        unitPrice: Math.round(item.price * 100),
      }));
      if (fees > 0) {
        lines.push({
          itemType: 'Other',
          itemName: 'Payment processing fee',
          quantity: 1,
          unitPrice: Math.round(fees * 100),
        });
      }

      const order = await createOrder({ source: 'POS', memberId: gymUserId, lines });
      const paid = await payOrder(order.id, {
        method: method as 'Cash' | 'GCash' | 'Card',
        amount: Math.round((total + fees) * 100),
      });

      const transaction: Transaction = {
        ...order,
        method,
        fees,
        paymentState: paid.status as PaymentState,
        status: paid.status === 'Successful' ? 'Paid' : 'Pending',
        receiptNumber: paid.receiptNumber ?? order.receiptNumber,
        isSimulated: false,
      };
      setTransactions((previous) => [transaction, ...previous]);
      setPayment({ transactionId: order.id, method, amount: total, fees });
      toast('Charge recorded — ' + (paid.receiptNumber ?? paid.status));
    } catch (error) {
      toast('Charge failed — ' + (error instanceof Error ? error.message : 'unknown error'));
    } finally {
      setCharging(false);
    }
  };

  const updatePaymentState = (paymentState: PaymentState) => {
    setTransactions((previous) => previous.map((transaction) => transaction.id === payment?.transactionId
      ? { ...transaction, paymentState }
      : transaction));
  };

  const completePayment = (paymentState: 'Successful' | 'Failed') => {
    if (paymentState === 'Successful') {
      toast('Sale recorded.');
      setCart([]);
    } else {
      toast('Payment did not complete.');
    }
  };

  return (
    <>
      <div className="grid grid-2-1 staff-pos">
        <TabbedCard title="Membership Plans">
          <p className="staff-pos-hint">Add one of each membership plan to this sale.</p>
          <div className="staff-pos-products">
            {items.map((item) => {
              const inCart = cart.some((entry) => entry.id === item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`card pos-item${inCart ? ' is-in-cart' : ''}`}
                  onClick={() => addPlan(item)}
                  disabled={inCart}
                  aria-pressed={inCart}
                >
                  <span className="staff-pos-plan-name">{item.name}</span>
                  <span className="staff-pos-plan-price">{peso(item.price)}</span>
                  <span className="staff-pos-plan-action">{inCart ? 'Added to cart' : 'Add to cart'}</span>
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
                  <option key={status} value={status}>{status}</option>
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
            <Select value={method} onChange={setMethod} aria-label="Payment method">
              <option>GCash</option><option>Cash</option>
            </Select>
          </Field>

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
              <div><span>Discount</span><strong>{peso(0)}</strong></div>
              <div><span>Configured fee</span><strong>{peso(fees)}</strong></div>
              <div className="staff-pos-grand-total"><span>Total</span><strong>{peso(total + fees)}</strong></div>
            </div>
            {feeError && <p className="staff-pos-fee-error" role="alert">{feeError}</p>}
            {method.toLowerCase() === 'gcash' && (
              <p className="staff-pos-fee-note">GCash fees shown here use the configured test value only.</p>
            )}
          </section>

          <button
            type="button"
            className="btn btn-signal btn-block staff-pos-charge"
            onClick={charge}
            disabled={cart.length === 0 || Boolean(feeError) || charging}
          >
            Charge {peso(total + fees)}
          </button>
        </TabbedCard>
      </div>
      {payment && <PaymentSimulationModal
        method={payment.method}
        amount={payment.amount}
        fees={payment.fees}
        onStateChange={updatePaymentState}
        onComplete={completePayment}
        onClose={() => setPayment(null)}
      />}
    </>
  );
}

export default StaffPOS;
