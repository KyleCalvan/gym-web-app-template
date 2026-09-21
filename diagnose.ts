// Run from node — fetches the rendered admin DOM via JSDOM
// @ts-nocheck — diagnostic script; not part of the production bundle.
import { ADMIN_VIEWS } from './src/views/admin.tsx';

console.log('Admin views:', Object.keys(ADMIN_VIEWS));
console.log('Has AdminDashboard:', typeof ADMIN_VIEWS['dashboard']);
