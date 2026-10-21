import AuditLogExplorer from '../shared/AuditLogExplorer.tsx';
import type { ViewProps } from '../types.ts';

export default function AdminActivity({ auditLog }: ViewProps) {
  const filteredAuditLog = (auditLog || []).filter((entry) => {
    const isDemo = /development demo account|demo[_ -]?login|demo login/i.test(`${entry.actor} ${entry.details || ''} ${entry.action}`);
    return !isDemo;
  });
  return <AuditLogExplorer auditLog={filteredAuditLog} title="Activity Logs" allowedRoles={['admin', 'staff', 'trainer', 'member']} />;
}