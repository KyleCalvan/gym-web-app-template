// @ts-nocheck
import type { ComponentType } from 'react';
import type { NavSection, ViewProps } from '../types.ts';
import AdminDashboard from './AdminDashboard.tsx';
import AdminMembers from './AdminMembers.tsx';
import AdminPlans from './AdminPlans.tsx';
import AdminPayments from './AdminPayments.tsx';
import AdminReports from './AdminReports.tsx';
import AdminPeople from './AdminPeople.tsx';
import AdminPromotions from './AdminPromotions.tsx';
import AdminActivity from './AdminActivity.tsx';
import AdminCoaching from './AdminCoaching.tsx';
import AdminProfile from './AdminProfile.tsx';

export const ADMIN_NAV: NavSection[] = [
  {section:'Main', items:[{id:'dashboard', label:'Dashboard', ic:'▤'}]},
  {section:'Members', items:[{id:'members', label:'Members', ic:'☰'}, {id:'plans', label:'Membership Plans', ic:'▥'}]},
  {section:'Finance', items:[{id:'payments', label:'Payments', ic:'₱'}, {id:'reports', label:'Revenue & Reports', ic:'▲'}]},
  {section:'Operations', items:[{id:'trainers', label:'Trainers & Staff', ic:'★'}, {id:'promotions', label:'Promotions', ic:'◆'}]},
  {section:'Reports', items:[{id:'activity', label:'Activity Logs', ic:'≡'}, {id:'coaching', label:'Coaching Sessions', ic:'●'}]},
];

export const ADMIN_VIEWS: Record<string, ComponentType<ViewProps>> = {
  dashboard: AdminDashboard as unknown as ComponentType<ViewProps>,
  members: AdminMembers as unknown as ComponentType<ViewProps>,
  plans: AdminPlans as unknown as ComponentType<ViewProps>,
  payments: AdminPayments as unknown as ComponentType<ViewProps>,
  reports: AdminReports as unknown as ComponentType<ViewProps>,
  trainers: AdminPeople as unknown as ComponentType<ViewProps>,
  promotions: AdminPromotions as unknown as ComponentType<ViewProps>,
  activity: AdminActivity as unknown as ComponentType<ViewProps>,
  coaching: AdminCoaching as unknown as ComponentType<ViewProps>,
  profile: AdminProfile as unknown as ComponentType<ViewProps>,
};