import { readFileSync, writeFileSync } from 'node:fs';

const target = 'src/lib/api-client.ts';
const original = readFileSync(target, 'utf8');
const eol = original.includes('\r\n') ? '\r\n' : '\n';
const lines = original.split('\r\n').join('\n').split('\n');

const kept = lines.filter((line) => !/^\s*middleName\s*:/.test(line));
const removed = lines.length - kept.length;

if (removed === 0) {
  process.stderr.write('No middleName line found.\n');
  process.exit(1);
}

writeFileSync(target, kept.join('\n').split('\n').join(eol), 'utf8');

const written = readFileSync(target, 'utf8');
if (/middleName/.test(written)) {
  process.stderr.write('middleName still present.\n');
  process.exit(2);
}

process.stdout.write('removed=' + removed + '\n');
process.exit(0);
