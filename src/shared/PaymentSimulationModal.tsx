import { useEffect, useRef, useState } from 'react';
import { Field } from './primitives/Field.tsx';
import { Modal } from './primitives/Modal.tsx';
import { Select } from './primitives/Select.tsx';
import { formatMoney as peso } from './utils/money';
import type { PaymentState } from '../types.ts';

interface PaymentSimulationModalProps {
  method: string;
  amount: number;
  fees?: number;
  onClose: (state: PaymentState) => void;
  onStateChange?: (state: PaymentState) => void;
  onComplete: (state: 'Successful' | 'Failed') => boolean | void;
  startCheckout?: () => Promise<{ checkoutUrl: string; reference: string }>;
  checkCheckout?: (reference: string) => Promise<'Pending' | 'Paid' | 'Failed'>;
  cancelCheckout?: (reference: string) => Promise<'Pending' | 'Paid' | 'Failed'>;
}

const OUTCOMES = [
  { value: 'Successful', label: 'Simulate successful payment' },
  { value: 'Failed', label: 'Simulate failed payment' },
];

const STATE_COPY: Record<PaymentState, string> = {
  Pending: 'Payment is pending. No payment has been recorded as paid.',
  Processing: 'Complete the test checkout in the PayMongo tab. This window will verify the payment.',
  Successful: 'Test payment confirmed. No real money was charged.',
  Failed: 'Test payment failed. No payment was recorded as paid.',
};

export function PaymentSimulationModal({
  method,
  amount,
  fees = 0,
  onClose,
  onStateChange,
  onComplete,
  startCheckout,
  checkCheckout,
  cancelCheckout,
}: PaymentSimulationModalProps) {
  const [state, setState] = useState<PaymentState>('Pending');
  const [outcome, setOutcome] = useState<'Successful' | 'Failed'>('Successful');
  const [error, setError] = useState('');
  const processingLock = useRef(false);
  const active = useRef(true);
  const checkout = useRef<{ checkoutUrl: string; reference: string } | null>(null);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  const updateState = (nextState: PaymentState) => {
    setState(nextState);
    onStateChange?.(nextState);
  };

  const closePayment = async () => {
    if (processingLock.current) return;
    if (!checkout.current || !cancelCheckout || state === 'Successful') { onClose(state); return; }
    processingLock.current = true;
    try {
      const result = await cancelCheckout(checkout.current.reference);
      if (result === 'Pending') {
        setError('PayMongo is still processing this payment. Check again before cancelling.');
        return;
      }
      if (result === 'Paid') {
        updateState('Processing');
        let canComplete: boolean | void;
        try { canComplete = onComplete('Successful'); }
        catch (cause) {
          console.error('Confirmed payment could not complete its next step:', cause);
          canComplete = false;
        }
        updateState('Successful');
        if (canComplete === false) setError('Payment was confirmed, but the next step could not be completed.');
        return;
      }
      updateState('Failed');
      checkout.current = null;
      onClose('Failed');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Checkout could not be cancelled.');
    } finally {
      processingLock.current = false;
    }
  };

  const processTestPayment = async () => {
    if (processingLock.current || state === 'Processing') return;
    processingLock.current = true;
    setError('');
    if (startCheckout && checkCheckout) {
      const popup = window.open('', '_blank');
      if (!popup) {
        setError('Allow pop-ups for this site to open PayMongo test checkout.');
        processingLock.current = false;
        return;
      }
      popup.document.title = 'Opening PayMongo test checkout…';
      updateState('Processing');
      try {
        const current = checkout.current ?? await startCheckout();
        checkout.current = current;
        if (!active.current) { popup.close(); return; }
        popup.location.assign(current.checkoutUrl);
        let closedChecks = 0;
        for (let attempt = 0; attempt < 150 && active.current; attempt += 1) {
          await new Promise(resolve => window.setTimeout(resolve, 2000));
          if (!active.current) break;
          const status = await checkCheckout(current.reference);
          if (status === 'Paid') {
            let canComplete: boolean | void;
            try { canComplete = onComplete('Successful'); }
            catch (cause) {
              console.error('Confirmed payment could not complete its next step:', cause);
              canComplete = false;
            }
            updateState('Successful');
            if (canComplete === false) setError('Payment was confirmed, but the next step could not be completed.');
            popup.close();
            return;
          }
          if (status === 'Failed') {
            checkout.current = null;
            onComplete('Failed');
            updateState('Failed');
            popup.close();
            return;
          }
          if (popup.closed && ++closedChecks >= 5) break;
        }
        if (active.current) {
          updateState('Pending');
          setError('Payment is still pending. Reopen the PayMongo tab to continue, or try again later.');
        }
      } catch (paymentError) {
        if (active.current) {
          updateState('Pending');
          setError(paymentError instanceof Error ? paymentError.message : 'PayMongo checkout could not be opened.');
        }
        popup.close();
      } finally {
        processingLock.current = false;
      }
      return;
    }
    updateState('Processing');
    window.setTimeout(() => {
      try {
        const canComplete = onComplete(outcome);
        updateState(outcome === 'Successful' && canComplete === false ? 'Failed' : outcome);
      } catch (paymentError) {
        setError('The test payment could not be completed. Please try again.');
        if (paymentError instanceof Error) console.error(paymentError);
        updateState('Failed');
      } finally {
        processingLock.current = false;
      }
    }, 700);
  };

  return (
    <Modal
      title={startCheckout ? 'PayMongo test payment' : 'Simulated payment'}
      onClose={() => void closePayment()}
      dismissible={state !== 'Processing'}
      showCloseButton={state !== 'Processing'}
    >
      <div className="payment-simulation">
        <p className="payment-simulation-banner" role="note">
          {startCheckout
            ? 'PayMongo test mode only — complete the payment on PayMongo’s hosted checkout. No real money will be charged.'
            : 'Test mode only — this local simulation does not contact a payment provider or charge real money.'}
        </p>
        <div className="payment-simulation-summary">
          <div><span>Method</span><strong>{method}</strong></div>
          <div><span>Amount</span><strong>{peso(amount)}</strong></div>
          <div><span>Configured fee</span><strong>{peso(fees)}</strong></div>
          <div className="payment-simulation-total"><span>Total (test)</span><strong>{peso(amount + fees)}</strong></div>
        </div>
        {method.trim().toLowerCase() === 'gcash' && (
          <p className="payment-simulation-fee-note">
            Additional GCash fees may apply in a real payment. This test uses only the explicitly configured fee shown above.
          </p>
        )}
        {!startCheckout && <Field label="Test outcome">
          <Select value={outcome} disabled={state === 'Processing'}
            onChange={value => setOutcome(value as 'Successful' | 'Failed')}>
            {OUTCOMES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
        </Field>}
        <div className={`payment-simulation-state payment-simulation-${state.toLowerCase()}`} role="status" aria-live="polite">
          <strong>{state}</strong>
          <span>{startCheckout ? STATE_COPY[state] : state === 'Processing' ? 'Simulated payment is processing.' : STATE_COPY[state]}</span>
        </div>
        {error && <p className="payment-simulation-error" role="alert">{error}</p>}
        <div className="payment-simulation-actions">
          {state !== 'Processing' && state !== 'Successful' && <button className="btn btn-outline" onClick={() => void closePayment()}>Cancel</button>}
          {state === 'Successful' && <button className="btn btn-outline" onClick={() => void closePayment()}>Done</button>}
          {(state === 'Pending' || state === 'Failed') && (
            <button type="button" className="btn btn-signal" onClick={processTestPayment}>
              {state === 'Failed' ? 'Retry test payment' : 'Start test payment'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
