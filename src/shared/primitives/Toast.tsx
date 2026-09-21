import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { spring } from '../../motion.tsx';

export interface ToastProps {
  message: string;
  onDone: () => void;
}

export function Toast({ message, onDone }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <motion.div
      className="toast"
      initial={{ x: 24, opacity: 0, scale: 0.95 }}
      animate={{ x: 0, opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.96 }}
      transition={spring.toast}
    >
      <span className="dot"></span>{message}
    </motion.div>
  );
}
