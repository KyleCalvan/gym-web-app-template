import type { Role } from '../types.ts';

const ROLES: readonly Role[] = ['member', 'staff', 'trainer', 'admin', 'superadmin'];

export function getAssignedRoles(email: string | null | undefined): Role[] {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) return [];

  const assignmentJson = process.env.ROLE_ASSIGNMENTS?.trim();
  if (assignmentJson) {
    let assignments: unknown;
    try {
      assignments = JSON.parse(assignmentJson);
    } catch {
      throw new Error('ROLE_ASSIGNMENTS must be a JSON object mapping emails to role arrays.');
    }
    if (!assignments || typeof assignments !== 'object' || Array.isArray(assignments)) {
      throw new Error('ROLE_ASSIGNMENTS must be a JSON object mapping emails to role arrays.');
    }

    const matchingEntry = Object.entries(assignments).find(
      ([assignedEmail]) => assignedEmail.trim().toLowerCase() === normalizedEmail,
    );
    if (matchingEntry) {
      const [, assignedRoles] = matchingEntry;
      if (!Array.isArray(assignedRoles) || assignedRoles.length === 0
        || assignedRoles.some((role) => typeof role !== 'string' || !ROLES.includes(role as Role))) {
        throw new Error(`ROLE_ASSIGNMENTS has an invalid role list for ${normalizedEmail}.`);
      }
      return [...new Set(assignedRoles as Role[])];
    }
  }

  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((assignedEmail) => assignedEmail.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(normalizedEmail) ? ['member', 'admin'] : ['member'];
}
