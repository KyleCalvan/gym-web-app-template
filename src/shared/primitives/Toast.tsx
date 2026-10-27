import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { spring } from '../../motion.tsx';

export type ToastTone = 'info' | 'success' | 'error';
export interface ToastProps { message: string; tone?: ToastTone; onDone: () => void; }

export function Toast({ message, tone = 'info', onDone }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDone, 4500);
    return () => clearTimeout(timer);
  }, [onDone]);
  return (
    <motion.div className={'toast toast-' + tone}
      initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      exit={{ opacity: 0, y: 6 }} transition={spring.toast}>
      <span className="dot" aria-hidden="true" />
      <span className="toast-message">{message}</span>
      <button className="toast-dismiss" type="button" aria-label="Dismiss notification" onClick={onDone}><X size={16} /></button>
    </motion.div>
  );
}
