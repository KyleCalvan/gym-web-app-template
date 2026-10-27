import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { ease } from '../../motion.tsx';
import { useEnterMotion } from '../hooks/useEnterMotion';

export interface ModalProps {
  title: string;
  onClose: () => void;
  children?: ReactNode;
  wide?: boolean;
  className?: string;
  showCloseButton?: boolean;
  blurBackdrop?: boolean;
  dismissible?: boolean;
}

export function Modal({ title, onClose, children, wide, className, showCloseButton = true, blurBackdrop = true, dismissible = true }: ModalProps) {
  const dialogRef = useEnterMotion<HTMLDivElement>();
  const overlayRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  const titleId = `modal-title-${useId()}`;
  onCloseRef.current = onClose;
  dismissibleRef.current = dismissible;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const focusableSelector = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const focusFirst = () => {
      const first = dialog?.querySelector<HTMLElement>(focusableSelector);
      (first || dialog)?.focus();
    };
    const frame = window.requestAnimationFrame(focusFirst);
    const onKey = (event: KeyboardEvent) => {
      const overlays = document.querySelectorAll('.modal-overlay');
      if (overlays[overlays.length - 1] !== overlayRef.current) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (dismissibleRef.current) onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((element) => element.offsetParent !== null);
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKey);
      previousFocus?.focus();
    };
  }, []);
  return createPortal(
    <motion.div
      ref={overlayRef}
      className={`modal-overlay${blurBackdrop ? '' : ' no-blur'}`}
      onMouseDown={(e) => { if (dismissible && e.target === e.currentTarget) onCloseRef.current(); }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: ease.out }}
    >
      <div
        ref={dialogRef}
        className={"modal " + (className || '')}
        style={wide ? { maxWidth: 640 } : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal-head">
          <h2 id={titleId} style={{ fontSize: 19.8, textTransform: 'uppercase' }}>{title}</h2>
          {showCloseButton && <button type="button" className="modal-close" onClick={onClose} aria-label={`Close ${title}`}>✕</button>}
        </div>
        {children}
      </div>
    </motion.div>,
    document.body
  );
}
