import { motion, type HTMLMotionProps } from 'framer-motion';
import { dur, ease, stagger } from '../motion.tsx';

/**
 * The fade-and-rise reveal shared by the landing page's cards.
 *
 * Each strip used to carry its own copy of this animation; extracting it keeps
 * them from drifting apart on timing. `as` picks the motion element (`div` by
 * default — the promo carousel needs `article` for its slide semantics) and
 * everything else passes straight through, so a card keeps its own class,
 * role and aria attributes.
 *
 * The delay is staggered by list position; pass no index for a standalone card.
 */
const TAGS = { div: motion.div, article: motion.article } as const;

type RevealCardProps = HTMLMotionProps<'div'> & {
  as?: keyof typeof TAGS;
  index?: number;
};

export default function RevealCard({ as = 'div', index = 0, ...rest }: RevealCardProps) {
  const Tag = TAGS[as];
  return (
    <Tag
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: dur.base, delay: index * stagger.list, ease: ease.out }}
      {...rest}
    />
  );
}
