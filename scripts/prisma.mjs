import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const backendRequire = createRequire(new URL('../backend/package.json', import.meta.url));

// This wrapper is shared by the frontend and a separately installed backend.
// Resolve tooling from whichever package was installed for the current command.
function resolveDependency(id) {
  try { return require.resolve(id); }
  catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
    return backendRequire.resolve(id);
  }
}

const nextEnv = require(resolveDependency('@next/env'));

// Prisma and Next.js must read the same root .env* files. Existing environment
// variables take precedence, including the disposable database in tests.
nextEnv.loadEnvConfig(root, process.env.NODE_ENV !== 'production');

const child = spawn(process.execPath, [
  resolveDependency('prisma/build/index.js'),
  ...process.argv.slice(2),
  `--schema=${fileURLToPath(new URL('../backend/prisma/schema.prisma', import.meta.url))}`,
], { cwd: root, env: process.env, stdio: 'inherit', windowsHide: true });

child.on('error', (error) => {
  console.error('Could not start Prisma:', error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => { process.exitCode = code ?? 1; });
