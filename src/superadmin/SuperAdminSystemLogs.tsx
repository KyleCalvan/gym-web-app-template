import AuditLogExplorer from '../shared/AuditLogExplorer.tsx';
import type { ViewProps } from '../types.ts';

export default function SuperAdminSystemLogs({ auditLog }: ViewProps) {
  return <AuditLogExplorer auditLog={auditLog} title="System Logs" />;
}
