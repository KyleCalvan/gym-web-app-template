import { AnimatePresence, motion } from 'framer-motion';
import { ease } from '../../motion.tsx';

export function Badge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Active: 'ok', Paid: 'ok', Confirmed: 'ok', Approved: 'ok', Completed: 'ok', Published: 'ok',
    Pending: 'warn', Expiring: 'warn', 'On Leave': 'warn', Draft: 'warn',
    Frozen: 'mute', Expired: 'bad', Refunded: 'bad', Cancelled: 'bad', Declined: 'bad', Void: 'bad',
  };
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={status}
        className={"badge " + (map[status] || 'mute')}
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: [1.12, 1], opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ duration: 0.22, ease: ease.out }}
        style={{ display: 'inline-block' }}
      >
        {status}
      </motion.span>
    </AnimatePresence>
  );
}
