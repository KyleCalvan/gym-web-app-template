// @ts-nocheck
import type { ComponentType } from 'react';
import type { NavSection, ViewProps } from '../types.ts';
import SuperAdminDashboard from './SuperAdminDashboard.tsx';
import SuperAdminUsers from './SuperAdminUsers.tsx';
import SuperAdminSystemLogs from './SuperAdminSystemLogs.tsx';
import SuperAdminBackups from './SuperAdminBackups.tsx';
import SuperAdminSessions from './SuperAdminSessions.tsx';
import SuperAdminTrash from './SuperAdminTrash.tsx';
import SuperAdminProfile from './SuperAdminProfile.tsx';

export const SUPERADMIN_NAV: NavSection[] = [
  { section: 'Main', items: [{ id: 'dashboard', label: 'Dashboard', ic: '▤' }] },
  { section: 'System', items: [
    { id: 'users', label: 'User Management', ic: '☰' },
    { id: 'system_logs', label: 'System Logs', ic: '≡' },
  ] },
  { section: 'Maintenance', items: [
    { id: 'trash', label: 'Archive', ic: '⌫' },
    { id: 'backups', label: 'Database Backups', ic: '◇' },
    { id: 'sessions', label: 'Active Sessions', ic: '●' },
  ] },
];

export const SUPERADMIN_VIEWS: Record<string, ComponentType<ViewProps>> = {
  dashboard:    SuperAdminDashboard      as unknown as ComponentType<ViewProps>,
  users:        SuperAdminUsers         as unknown as ComponentType<ViewProps>,
  system_logs:  SuperAdminSystemLogs    as unknown as ComponentType<ViewProps>,
  backups:      SuperAdminBackups       as unknown as ComponentType<ViewProps>,
  sessions:     SuperAdminSessions      as unknown as ComponentType<ViewProps>,
  trash:        SuperAdminTrash         as unknown as ComponentType<ViewProps>,
  profile:      SuperAdminProfile       as unknown as ComponentType<ViewProps>,
};
