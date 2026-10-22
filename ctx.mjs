import { readFileSync, writeFileSync } from 'node:fs';

const lines = readFileSync('app/api/members/[id]/route.ts', 'utf8').split(/\r?\n/);
const out = [];
for (let index = 36; index <= 50; index += 1) {
  out.push(`${index}\t${lines[index - 1] ?? ''}`);
}
writeFileSync('ctx.txt', out.join('\n'), 'utf8');
process.exit(0);
