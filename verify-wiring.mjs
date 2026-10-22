import { readFileSync } from 'node:fs';

const files = [
  'app/api/members/route.ts',
  'app/api/members/[id]/route.ts',
  'app/api/members/[id]/membership/route.ts',
  'app/api/bookings/route.ts',
  'src/lib/api-client.ts',
  'src/App.tsx',
  'src/admin/AdminMembers.tsx',
];

const report = {};
for (const file of files) {
  let source = '';
  try {
    source = readFileSync(file, 'utf8');
  } catch (error) {
    report[file] = { error: String(error) };
    continue;
  }
  const count = (pattern) => (source.match(pattern) ?? []).length;
  report[file] = {
    lines: source.split('\n').length,
    findFirst: count(/findFirst/g),
    membershipExpiresAt: count(/membershipExpiresAt/g),
    membershipsInclude: count(/memberships: \{ orderBy/g),
    wherePlainId: count(/where: \{ id \}/g),
    fetchCalls: count(/\bfetch\(/g),
    apiClientImport: count(/api-client/g),
  };
}

process.stdout.write(JSON.stringify(report, null, 2));
