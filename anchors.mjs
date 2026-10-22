import { readFileSync, writeFileSync } from 'node:fs';

const files = ['app/api/members/route.ts', 'app/api/members/[id]/route.ts'];
const patterns = [/memberToJson/, /memberships: \{ orderBy/, /findMany\(/, /NextResponse\.json\(\{ members/, /const members =/];

const out = [];
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (patterns.some((pattern) => pattern.test(line))) {
      out.push(`${file}:${index + 1}: ${line.trim()}`);
    }
  });
}

writeFileSync('anchors.txt', out.join('\n'), 'utf8');
process.exit(0);
