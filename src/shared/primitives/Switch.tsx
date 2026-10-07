import { motion } from 'framer-motion';
import { ease } from '../../motion.tsx';

export function Switch({
  on,
  onClick,
  ariaLabel,
}: {
  on: boolean;
  onClick: () => void;
  ariaLabel?: string;
}) {
  return (
    <div
      className={'switch' + (on ? ' on' : '')}
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <motion.div
        className="knob"
        animate={{ x: on ? 18 : 0 }}
        transition={{ duration: 0.18, ease: ease.inOut }}
      />
    </div>
  );
}
