'use client';

import { SessionProvider } from 'next-auth/react';
import { MotionConfig } from 'framer-motion';
import type { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider><MotionConfig reducedMotion="user">{children}</MotionConfig></SessionProvider>;
}
