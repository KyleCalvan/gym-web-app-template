import { useEffect, useRef } from 'react';
import { animate, createScope } from 'animejs';

/** Entry only: React owns mounting and focus; existing presence boundaries own exits. */
export function useEnterMotion<T extends HTMLElement>(key: unknown = true, distance = 6) {
  const root = useRef<T>(null);
  useEffect(() => {
    const element = root.current;
    if (!element || !key) return;
    const scope = createScope({ root: element, mediaQueries: { reduced: '(prefers-reduced-motion: reduce)' } }).add(self => {
      if (self && !self.matches.reduced) animate(element, { opacity: [0.92, 1], y: [distance, 0], duration: 200, ease: 'outCubic' });
    });
    return () => scope.revert();
  }, [key, distance]);
  return root;
}
