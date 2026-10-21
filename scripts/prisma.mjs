import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import nextEnv from '@next/env';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);

// Prisma and Next.js must read the same root .env* files. Existing environment
// variables take precedence, including the disposable database in tests.
nextEnv.loadEnvConfig(root, process.env.NODE_ENV !== 'production');

const child = spawn(process.execPath, [
  require.resolve('prisma/build/index.js'),
  ...process.argv.slice(2),
  `--schema=${fileURLToPath(new URL('../backend/prisma/schema.prisma', import.meta.url))}`,
], { cwd: root, env: process.env, stdio: 'inherit', windowsHide: true });

child.on('error', (error) => {
  console.error('Could not start Prisma:', error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => { process.exitCode = code ?? 1; });
