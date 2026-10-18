import AuditLogExplorer from '../shared/AuditLogExplorer.tsx';
import type { ViewProps } from '../types.ts';

export default function AdminActivity({ auditLog }: ViewProps) {
  return <AuditLogExplorer auditLog={auditLog} title="Activity Logs" label="Reports" />;
}
