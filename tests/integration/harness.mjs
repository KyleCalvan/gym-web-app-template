import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, writeFile, unlink, rm } from 'node:fs/promises';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import pg from 'pg';

const root = fileURLToPath(new URL('../../', import.meta.url));
const execute = promisify(execFile);

export async function removeTestDirectory(directory) {
  const relative = path.relative(tmpdir(), directory);
  if (relative.startsWith('..') || path.isAbsolute(relative) || !relative.startsWith('vinathletics-test-')) {
    throw new Error('Refusing to remove a directory outside the disposable test area.');
  }
  await rm(directory, { recursive: true, force: true });
}

// Never inherit DATABASE_URL, PG*, OAuth credentials, or Next's cached dotenv
// state. Every database address is constructed from the cluster we just started.
function systemEnvironment() {
  const allowed = /^(path|systemroot|windir|comspec|pathext|temp|tmp|tmpdir|home|userprofile|appdata|localappdata|lang|lc_all)$/i;
  return Object.fromEntries(Object.entries(process.env).filter(([key]) => allowed.test(key)));
}

async function unusedPort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

export async function startDatabase() {
  if (process.getuid?.() === 0) {
    throw new Error('Run integration tests as a non-root user; the harness does not create operating-system users.');
  }
  const directory = await mkdtemp(path.join(tmpdir(), 'vinathletics-test-'));
  const port = await unusedPort();
  const password = randomBytes(24).toString('hex');
  // Use the runner's platform binaries directly: its global beforeExit hook
  // can turn unfinished node:test hooks into a successful process exit.
  const platform = process.platform === 'win32' ? 'windows' : process.platform;
  const binaries = await import(`@embedded-postgres/${platform}-${process.arch}`);
  const cluster = path.join(directory, 'postgres');
  const passwordFile = path.join(directory, 'password');
  const logFile = path.join(directory, 'postgres.log');
  const options = { env: systemEnvironment(), windowsHide: true, timeout: 30_000 };
  const stopCluster = async () => {
    await execute(binaries.pg_ctl, ['-D', cluster, '-m', 'immediate', '-w', 'stop'], options);
  };
  await writeFile(passwordFile, password, { mode: 0o600 });
  try {
    await execute(binaries.initdb, [
      '-D', cluster, '-U', 'postgres', '--auth=scram-sha-256',
      `--pwfile=${passwordFile}`, '--encoding=UTF8', '--locale=C',
    ], options);
    await execute(binaries.pg_ctl, [
      '-D', cluster, '-l', logFile, '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start',
    ], options);
    const client = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', password, database: 'postgres' });
    await client.connect();
    try {
      await client.query('CREATE DATABASE vinathletics_test');
    } finally {
      await client.end();
    }
  } catch (error) {
    await stopCluster().catch(() => {});
    const logs = await readFile(logFile, 'utf8').catch(() => '');
    await removeTestDirectory(directory);
    throw new Error(`Disposable PostgreSQL failed to start:\n${logs}`, { cause: error });
  } finally {
    await unlink(passwordFile).catch(() => {});
  }
  return {
    env: {
      ...systemEnvironment(),
      NODE_ENV: 'test',
      DATABASE_URL: `postgresql://postgres:${password}@127.0.0.1:${port}/vinathletics_test?schema=public`,
      NEXTAUTH_SECRET: randomBytes(32).toString('hex'),
      GOOGLE_CLIENT_ID: 'isolated-test-client',
      GOOGLE_CLIENT_SECRET: 'isolated-test-secret',
      DEMO_ACCOUNTS_ENABLED: 'false',
      ROLE_ASSIGNMENTS: '{}',
      ADMIN_EMAILS: '',
      ACTIVE_PLAN_LIMIT: '4',
      NEXT_TELEMETRY_DISABLED: '1',
    },
    directory,
    async stop() {
      await stopCluster();
      await removeTestDirectory(directory);
    },
  };
}

export async function runNode(script, args, env) {
  try {
    const result = await execute(process.execPath, [path.resolve(root, script), ...args], {
      cwd: root, env, windowsHide: true, timeout: 240_000, maxBuffer: 8 * 1024 * 1024,
    });
    return result.stdout + result.stderr;
  } catch (error) {
    throw new Error(`${script} ${args[0]} failed:\n${error.stdout ?? ''}${error.stderr ?? ''}`, { cause: error });
  }
}

// Fixture setup and migration assertions only; application behavior is tested
// through HTTP, never by importing route handlers or mocking Prisma.
export async function withDatabaseClient(env, action) {
  const schema = new URL(env.DATABASE_URL).searchParams.get('schema') ?? 'public';
  const client = new pg.Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("SELECT set_config('search_path', $1, false)", [schema]);
    return await action(client);
  } finally {
    await client.end();
  }
}

export async function startApplication(env, { https = false } = {}) {
  const port = await unusedPort();
  const url = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [
    path.join(root, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port),
  ], {
    cwd: root, env: { ...env, NODE_ENV: 'production', NEXTAUTH_URL: https ? url.replace('http:', 'https:') : url },
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const exited = once(child, 'exit');
  const stop = async () => {
    if (child.exitCode === null) child.kill();
    await exited;
  };
  for (let attempt = 0; attempt < 200; attempt++) {
    if (child.exitCode !== null) break;
    try {
      const response = await fetch(`${url}/api/auth/providers`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return { url, stop, logs: () => output };
    } catch { /* Wait for Next.js to bind its port. */ }
    await delay(100);
  }
  await stop();
  throw new Error(`Next.js did not start:\n${output}`);
}
