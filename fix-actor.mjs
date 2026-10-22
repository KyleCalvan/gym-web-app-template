import { readFileSync, writeFileSync } from 'node:fs';

const targets = [
  'app/api/members/route.ts',
  'app/api/members/[id]/route.ts',
];

let changed = 0;
for (const target of targets) {
  const original = readFileSync(target, 'utf8');
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  let source = original.split('\r\n').join('\n');
  const before = source;
  source = source.split('actor: caller.accountId,').join('actor: caller.accountId ?? undefined,');
  if (source !== before) {
    writeFileSync(target, source.split('\n').join(eol), 'utf8');
    changed += 1;
  }
}

process.stdout.write('changed=' + changed + '\n');
process.exit(0);
