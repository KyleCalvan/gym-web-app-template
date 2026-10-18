import { useRef, useState } from 'react';
import { Field } from './primitives/Field.tsx';
import { Modal } from './primitives/Modal.tsx';
import { Select } from './primitives/Select.tsx';
import { peso } from '../data.ts';
import type { PaymentState } from '../types.ts';

interface PaymentSimulationModalProps {
  method: string;
  amount: number;
  fees?: number;
  onClose: (state: PaymentState) => void;
  onStateChange?: (state: PaymentState) => void;
  onComplete: (state: 'Successful' | 'Failed') => boolean | void;
}

const OUTCOMES = [
  { value: 'Successful', label: 'Simulate successful payment' },
  { value: 'Failed', label: 'Simulate failed payment' },
];

const STATE_COPY: Record<PaymentState, string> = {
  Pending: 'Payment is pending. No payment has been recorded as paid.',
  Processing: 'Test payment is processing. Do not close this window.',
  Successful: 'Simulated payment successful. No real money was charged.',
  Failed: 'Simulated payment failed. No payment was recorded as paid.',
};

export function PaymentSimulationModal({
  method,
  amount,
  fees = 0,
  onClose,
  onStateChange,
  onComplete,
}: PaymentSimulationModalProps) {
  const [state, setState] = useState<PaymentState>('Pending');
  const [outcome, setOutcome] = useState<'Successful' | 'Failed'>('Successful');
  const [error, setError] = useState('');
  const processingLock = useRef(false);

  const updateState = (nextState: PaymentState) => {
    setState(nextState);
    onStateChange?.(nextState);
  };

  const processTestPayment = () => {
    if (processingLock.current || state === 'Processing') return;
    processingLock.current = true;
    setError('');
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
      title="Simulated payment"
      onClose={() => onClose(state)}
      dismissible={state !== 'Processing'}
      showCloseButton={state !== 'Processing'}
    >
      <div className="payment-simulation">
        <p className="payment-simulation-banner" role="note">
          Test mode only — this flow does not contact GCash or another payment provider and does not charge real money.
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
        <Field label="Test outcome">
          <Select
            value={outcome}
            disabled={state === 'Processing'}
            onChange={(value) => setOutcome(value as 'Successful' | 'Failed')}
          >
            {OUTCOMES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
        </Field>
        <div className={`payment-simulation-state payment-simulation-${state.toLowerCase()}`} role="status" aria-live="polite">
          <strong>{state}</strong>
          <span>{STATE_COPY[state]}</span>
        </div>
        {error && <p className="payment-simulation-error" role="alert">{error}</p>}
        <div className="payment-simulation-actions">
          {state !== 'Processing' && state !== 'Successful' && <button className="btn btn-outline" onClick={() => onClose(state)}>Cancel</button>}
          {state === 'Successful' && <button className="btn btn-outline" onClick={() => onClose(state)}>Done</button>}
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
