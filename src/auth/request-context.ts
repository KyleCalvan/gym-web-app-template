import { AsyncLocalStorage } from 'node:async_hooks';

export const authRequestContext = new AsyncLocalStorage<{ requestId: string; accountId: string | null }>();
