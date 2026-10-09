// Shared helpers for the landing page components.

import type { SyntheticEvent } from 'react';

/**
 * Smooth-scrolls to a section by its anchor id and suppresses the browser's
 * default anchor jump. Returns whether the target existed, so callers can gate
 * side effects on a real navigation — e.g. LandingNav only closes the mobile
 * drawer when the link actually went somewhere.
 */
export function scrollToSection(e: SyntheticEvent, id: string): boolean {
  const el = document.getElementById(id);
  if (!el) return false;
  e.preventDefault();
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return true;
}

/**
 * Joins class names, skipping falsy values. Keeps the conditional-class
 * ternaries readable at the call sites instead of string-concatenated inline.
 */
export function cx(...parts: unknown[]): string {
  return parts.filter((p) => Boolean(p)).join(' ');
}
