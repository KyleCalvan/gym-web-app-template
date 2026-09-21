import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  useInView,
  useAnimationControls,
  type AnimationPlaybackControls,
} from 'framer-motion';
import { useEffect, useRef } from 'react';

// Shared motion vocabulary. Importing from here keeps timings & easings
// consistent across every animated surface in the app.

export const ease = {
  out: [0.2, 0.7, 0.2, 1] as [number, number, number, number],
  inOut: [0.45, 0, 0.2, 1] as [number, number, number, number],
};

export const dur = {
  fast: 0.18,
  base: 0.32,
  slow: 0.6,
  ticker: 0.9,
  bar: 0.5,
  donut: 0.7,
};

export const spring = {
  toast: { stiffness: 380, damping: 22 },
  pop:   { stiffness: 360, damping: 18 },
};

// Stagger gaps
export const stagger = {
  tile: 0.06,
  chart: 0.12,
  list: 0.04,
};

// Variants

// Soft fade-up used for stat tiles, hero items, nav items.
export const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: dur.base, ease: ease.out },
  },
};

// Slide+fade used by stepper bodies (booking checkout).
export const slideStep = {
  enter: { x: 24, opacity: 0 },
  center: { x: 0, opacity: 1, transition: { duration: dur.base, ease: ease.out } },
  exit: { x: -24, opacity: 0, transition: { duration: dur.fast, ease: ease.out } },
};

interface TickerProps {
  to: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  format?: (n: number) => string | number;
  asText?: boolean;
}

// Ticker: count from 0 → value. Pass prefix/suffix for currency, etc.
// Optional `format` lets you shape the displayed number (e.g. comma).
// Pass `asText` to render the number as a plain text node (no wrapper span)
// — used inside <text> SVG elements and other contexts where <span> isn't valid.
//
// NOTE: useTransform() returns a MotionValue object, not a live number —
// it can only be bound to a `style` prop, never rendered directly as a
// React child (that throws "Objects are not valid as a React child").
// So instead of rendering the MotionValue, we subscribe to its changes
// and write the formatted text straight to the DOM node via a ref.
export function Ticker({ to, duration = dur.ticker, prefix = '', suffix = '', format, asText }: TickerProps) {
  const mv = useMotionValue(0);
  const nodeRef = useRef<SVGTextElement | HTMLSpanElement | null>(null);

  // Drive the animation from 0 -> to
  useEffect(() => {
    const controls: AnimationPlaybackControls = animate(mv, to, { duration, ease: ease.out });
    return () => controls.stop();
  }, [to, duration, mv]);

  // Push formatted value into the DOM node directly on every tick
  useEffect(() => {
    const unsubscribe = mv.on('change', (latest: number) => {
      const display = format ? format(latest) : Math.round(latest);
      if (nodeRef.current) {
        nodeRef.current.textContent = `${prefix}${display}${suffix}`;
      }
    });
    return unsubscribe;
  }, [prefix, suffix, format, mv]);

  const initial = `${prefix}${format ? format(0) : 0}${suffix}`;

  if (asText) {
    return <motion.text ref={nodeRef as React.Ref<SVGTextElement>}>{initial}</motion.text>;
  }
  return <motion.span ref={nodeRef as React.Ref<HTMLSpanElement>}>{initial}</motion.span>;
}

// Per-segment donut draw-in (kept for reference; the actual Donut component
// animates strokeDashoffset directly because pathLength only works on
// <path>/<line>, not <circle>).
export const drawDonut = (i: number) => ({
  initial: { strokeDashoffset: 0 },
  animate: { strokeDashoffset: 0, transition: { duration: dur.donut, delay: i * stagger.chart, ease: ease.out } },
});

// Per-bar grow variant. `target` must be a stable numeric (memoize it).
export const growBar = (i: number, target: number | string) => ({
  initial: { height: 0 },
  animate: {
    height: target,
    transition: { duration: dur.bar, delay: i * 0.05, ease: ease.out },
  },
});

// Re-exports so consumers can import in one line.
export {
  motion, useMotionValue, useTransform, animate, useInView, useAnimationControls, useEffect,
};
