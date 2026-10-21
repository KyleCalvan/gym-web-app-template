// Test-process boundary only. Application sessions still use the real service,
// routes and PostgreSQL; a file controls the wall clock in the child process.
const { readFileSync } = require('node:fs');
const NativeDate = Date;
function now() {
  const value = readFileSync(process.env.INTEGRATION_CLOCK_FILE, 'utf8').trim();
  return value ? Number(value) : NativeDate.now();
}
global.Date = class extends NativeDate {
  constructor(...args) { super(...(args.length ? args : [now()])); }
  static now() { return now(); }
};
