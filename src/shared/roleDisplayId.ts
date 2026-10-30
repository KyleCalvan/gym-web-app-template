import type { Role } from '../types';

const PREFIX: Record<Role, string> = {
  member: 'M', trainer: 'TR', staff: 'ST', admin: 'AD', superadmin: 'SA',
};

// The gym user's database sequence is unique and stable; role profiles keep their
// existing internal IDs for relationships and mutations.
export function roleDisplayId(role: Role, gymUserId: number): string {
  return `${PREFIX[role]}-${gymUserId + 1000}`;
}
