// @ts-nocheck
import type { ComponentType } from 'react';
import type { NavSection, ViewProps } from '../types.ts';
import MemberDashboard from './MemberDashboard.tsx';
import MemberMembership from './MemberMembership.tsx';
import MemberCoaching from './MemberCoaching.tsx';
import MemberPayments from './MemberPayments.tsx';
import MemberProfile from './MemberProfile.tsx';
import MemberActivity from './MemberActivity.tsx';
import NotificationsModal from './NotificationsModal.tsx';

export { NotificationsModal };

export const MEMBER_NAV: NavSection[] = [
  {section:'My Account', items:[{id:'dashboard', label:'Dashboard', ic:'▤'}]},
  {section:'Membership', items:[{id:'membership', label:'My Membership', ic:'▥'}]},
  {section:'Training', items:[{id:'coaching', label:'Coaching Sessions', ic:'●'}, {id:'activity', label:'Activity', ic:'≡'}]},
  {section:'Finance', items:[{id:'payments', label:'My Payments', ic:'₱'}]},
  {section:'Other', items:[{id:'notifications', label:'Notifications', ic:'◆'}, {id:'profile', label:'Profile', ic:'◉'}]},
];

export const MEMBER_VIEWS: Record<string, ComponentType<ViewProps>> = {
  dashboard: MemberDashboard as unknown as ComponentType<ViewProps>,
  membership: MemberMembership as unknown as ComponentType<ViewProps>,
  coaching: MemberCoaching as unknown as ComponentType<ViewProps>,
  activity: MemberActivity as unknown as ComponentType<ViewProps>,
  payments: MemberPayments as unknown as ComponentType<ViewProps>,
  profile: MemberProfile as unknown as ComponentType<ViewProps>,
};