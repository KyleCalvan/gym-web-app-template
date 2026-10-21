import type { DefaultSession } from 'next-auth';
import type { Role } from '../types.ts';
import type { AccountNextStep } from './account-contract';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string;
      role: Role | null;
      roles: Role[];
      gymUserId: number | null;
      restricted: boolean;
      nextSteps: AccountNextStep[];
    };
  }
}
