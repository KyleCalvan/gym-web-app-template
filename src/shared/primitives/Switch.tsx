import { motion } from 'framer-motion';
import { ease } from '../../motion.tsx';

export function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <div className={"switch" + (on ? " on" : "")} onClick={onClick}>
      <motion.div
        className="knob"
        animate={{ x: on ? 18 : 0 }}
        transition={{ duration: 0.18, ease: ease.inOut }}
      />
    </div>
  );
}
