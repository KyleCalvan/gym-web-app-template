// Boots the packaged embedded PostgreSQL on the port/database named by .env.
// Idempotent: reuses an initialized cluster and an already-listening server.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import net from 'node:net';
import path from 'node:path';
import pg from 'pg';

const execute = promisify(execFile);
const envText = readFileSync('.env', 'utf8');
const line = envText.split(/\r?\n/).find((l) => l.trim().startsWith('DATABASE_URL='));
if (!line) throw new Error('DATABASE_URL not found in .env');
const raw = line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
const parsed = new URL(raw);
const password = decodeURIComponent(parsed.password);
const port = Number(parsed.port || 5432);
const database = parsed.pathname.replace(/^\//, '') || 'postgres';
const host = parsed.hostname === 'localhost' ? '127.0.0.1' : parsed.hostname;

const base = path.join(tmpdir(), 'vinathletics-dev-pg');
const cluster = path.join(base, 'postgres');
const logFile = path.join(base, 'postgres.log');
mkdirSync(base, { recursive: true });

const allowed = /^(path|systemroot|windir|comspec|pathext|temp|tmp|tmpdir|home|userprofile|appdata|localappdata|lang|lc_all)$/i;
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => allowed.test(k)));
const options = { env, windowsHide: true, timeout: 120_000 };
const platform = process.platform === 'win32' ? 'windows' : process.platform;
const binaries = await import(`@embedded-postgres/${platform}-${process.arch}`);

function portOpen() {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port }, () => { socket.destroy(); resolve(true); });
    socket.on('error', () => resolve(false));
    socket.setTimeout(1000, () => { socket.destroy(); resolve(false); });
  });
}

if (!existsSync(path.join(cluster, 'PG_VERSION'))) {
  const pwFile = path.join(base, 'pw');
  writeFileSync(pwFile, password, { mode: 0o600 });
  try {
    await execute(binaries.initdb, ['-D', cluster, '-U', 'postgres', '--auth=scram-sha-256',
      `--pwfile=${pwFile}`, '--encoding=UTF8', '--locale=C'], options);
    console.log('initdb ok');
  } finally {
    unlinkSync(pwFile);
  }
} else {
  console.log('cluster exists');
}

if (await portOpen()) {
  console.log(`already listening on ${host}:${port}`);
} else {
  await execute(binaries.pg_ctl, ['-D', cluster, '-l', logFile, '-o', `-h ${host} -p ${port}`, '-w', 'start'], options);
  console.log(`started on ${host}:${port}`);
}

const client = new pg.Client({ host, port, user: 'postgres', password, database: 'postgres' });
await client.connect();
try {
  const { rows } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
  if (rows.length === 0) {
    await client.query(`CREATE DATABASE "${database.replace(/"/g, '""')}"`);
    console.log(`created database ${database}`);
  } else {
    console.log(`database ${database} exists`);
  }
} finally {
  await client.end();
}
console.log('PG_READY');
