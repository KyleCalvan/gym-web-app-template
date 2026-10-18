import type { DefaultSession } from 'next-auth';
import type { Role } from '../types.ts';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string;
      role: Role;
      roles: Role[];
      gymUserId: number | null;
    };
  }
}
