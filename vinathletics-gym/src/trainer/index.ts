// @ts-nocheck
import type { ComponentType } from 'react';
import type { NavSection, ViewProps } from '../types.ts';
import TrainerDashboard from './TrainerDashboard.tsx';
import TrainerSessions from './TrainerSessions.tsx';
import TrainerSchedule from './TrainerSchedule.tsx';
import TrainerProfile from './TrainerProfile.tsx';

export const TRAINER_NAV: NavSection[] = [
  {section:'Overview', items:[{id:'dashboard', label:'Dashboard', ic:'▤'}]},
  {section:'Coaching', items:[{id:'sessions', label:'Sessions', ic:'✦'}, {id:'schedule', label:'Schedule', ic:'◷'}]},
  {section:'Account', items:[{id:'profile', label:'Profile', ic:'◉'}]},
];

export const TRAINER_VIEWS: Record<string, ComponentType<ViewProps>> = {
  dashboard: TrainerDashboard as unknown as ComponentType<ViewProps>,
  sessions: TrainerSessions as unknown as ComponentType<ViewProps>,
  schedule: TrainerSchedule as unknown as ComponentType<ViewProps>,
  profile: TrainerProfile as unknown as ComponentType<ViewProps>,
};