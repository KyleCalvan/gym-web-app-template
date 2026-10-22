import { readFileSync, writeFileSync } from 'node:fs';

const target = 'app/api/members/[id]/route.ts';
const original = readFileSync(target, 'utf8');
const eol = original.includes('\r\n') ? '\r\n' : '\n';
let source = original.split('\r\n').join('\n');

const declaration = [
  'const memberDetailInclude = {',
  '  gymUser: { select: { id: true, email: true, name: true } },',
  '} as const;',
  '',
].join('\n');

if (!source.includes('const memberDetailInclude')) {
  process.stderr.write('declaration already gone\n');
} else {
  source = source.replace(declaration, '');
  source = source.split('include: memberDetailInclude,').join(
    'include: { gymUser: { select: { id: true, email: true, name: true } } },',
  );
}

if (source.includes('memberDetailInclude')) {
  process.stderr.write('memberDetailInclude still referenced\n');
  process.exit(1);
}

writeFileSync(target, source.split('\n').join(eol), 'utf8');
const written = readFileSync(target, 'utf8');
if (written.includes('memberDetailInclude')) process.exit(2);
process.exit(0);
