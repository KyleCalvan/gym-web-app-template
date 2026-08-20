// Run from node — fetches the rendered admin DOM via JSDOM
import { ADMIN_VIEWS } from './src/views/admin.jsx';
console.log('Admin views:', Object.keys(ADMIN_VIEWS));
console.log('Has AdminDashboard:', typeof ADMIN_VIEWS.dashboard);
