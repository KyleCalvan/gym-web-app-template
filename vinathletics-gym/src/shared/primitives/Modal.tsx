import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { ease } from '../../motion.tsx';

export interface ModalProps {
  title: string;
  onClose: () => void;
  children?: ReactNode;
  wide?: boolean;
  className?: string;
}

export function Modal({ title, onClose, children, wide, className }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <motion.div
      className="modal-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: ease.out }}
    >
      <motion.div
        className={"modal " + (className || '')}
        style={wide ? { maxWidth: 640 } : undefined}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.22, ease: ease.out }}
      >
        <div className="modal-head">
          <h2 style={{ fontSize: 18, textTransform: 'uppercase' }}>{title}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {children}
      </motion.div>
    </motion.div>,
    document.body
  );
}
