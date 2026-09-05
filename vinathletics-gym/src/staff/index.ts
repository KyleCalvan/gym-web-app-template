// @ts-nocheck
import type { ComponentType } from 'react';
import type { NavSection, ViewProps } from '../types.ts';
import StaffDashboard from './StaffDashboard.tsx';
import StaffMembers from './StaffMembers.tsx';
import StaffPOS from './StaffPOS.tsx';
import StaffTransactions from './StaffTransactions.tsx';
import StaffSchedules from './StaffSchedules.tsx';
import StaffProfile from './StaffProfile.tsx';

export const STAFF_NAV: NavSection[] = [
  {section:'Main', items:[{id:'dashboard', label:'Dashboard', ic:'▤'}]},
  {section:'Members', items:[{id:'members', label:'Members', ic:'☰'}]},
  {section:'Finance', items:[{id:'pos', label:'Point of Sale', ic:'₱'}, {id:'transactions', label:'My Transactions', ic:'▲'}]},
  {section:'Operations', items:[{id:'schedules', label:'Trainer Schedules', ic:'●'}]},
];

export const STAFF_VIEWS: Record<string, ComponentType<ViewProps>> = {
  dashboard: StaffDashboard as unknown as ComponentType<ViewProps>,
  members: StaffMembers as unknown as ComponentType<ViewProps>,
  pos: StaffPOS as unknown as ComponentType<ViewProps>,
  transactions: StaffTransactions as unknown as ComponentType<ViewProps>,
  schedules: StaffSchedules as unknown as ComponentType<ViewProps>,
  profile: StaffProfile as unknown as ComponentType<ViewProps>,
};
