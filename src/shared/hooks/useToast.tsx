import { useCallback, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Toast, type ToastTone } from '../primitives/Toast';

export function useToast(): [ReactNode, (message: string, tone?: ToastTone) => void] {
  const [toast, setToast] = useState<{ message: string; tone: ToastTone; id: number } | null>(null);
  const sequence = useRef(0);
  const fire = useCallback((message: string, tone: ToastTone = 'info') => {
    setToast({ message, tone, id: ++sequence.current });
  }, []);
  const dismiss = useCallback(() => setToast(null), []);
  return [
    <div role="status" aria-live="polite" aria-atomic="true">
      <AnimatePresence>{toast && <Toast key={toast.id} message={toast.message} tone={toast.tone} onDone={dismiss} />}</AnimatePresence>
    </div>,
    fire,
  ];
}
