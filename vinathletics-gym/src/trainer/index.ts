// @ts-nocheck
import type { ComponentType } from 'react';
import type { NavSection, ViewProps } from '../types.ts';
import TrainerDashboard from './TrainerDashboard.tsx';
import TrainerSessions from './TrainerSessions.tsx';
import TrainerSchedule from './TrainerSchedule.tsx';
import TrainerProfile from './TrainerProfile.tsx';

export const TRAINER_NAV: NavSection[] = [
  {
    section: 'Main',
    items: [
      { id: 'dashboard', label: 'Dashboard', ic: '▤' },
      { id: 'sessions',  label: 'Assigned Sessions', ic: '◉' },
      { id: 'schedule',  label: 'Schedule & Availability', ic: '◷' },
      { id: 'profile',   label: 'My Profile', ic: '◆' },
    ],
  },
  {
    section: 'Session',
    items: [
      // Log Out lives in the shell sidebar itself; kept here for reference.
    ],
  },
];

export const TRAINER_VIEWS: Record<string, ComponentType<ViewProps>> = {
  dashboard: TrainerDashboard as unknown as ComponentType<ViewProps>,
  sessions: TrainerSessions as unknown as ComponentType<ViewProps>,
  schedule: TrainerSchedule as unknown as ComponentType<ViewProps>,
  profile: TrainerProfile as unknown as ComponentType<ViewProps>,
};
