// @ts-nocheck
import { useState, type ReactNode } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Toast } from '../primitives/Toast';

export function useToast(): [ReactNode, (msg: string) => void] {
  const [toast, setToast] = useState<string | null>(null);
  const fire = (msg: string) => setToast(msg);
  const node = (
    <AnimatePresence>
      {toast ? <Toast key={toast} message={toast} onDone={() => setToast(null)} /> : null}
    </AnimatePresence>
  );
  return [node, fire];
}