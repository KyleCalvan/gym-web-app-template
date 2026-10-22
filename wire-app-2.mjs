import { readFileSync, writeFileSync } from 'node:fs';

const target = 'src/App.tsx';
const original = readFileSync(target, 'utf8');
const eol = original.includes('\r\n') ? '\r\n' : '\n';
let source = original.split('\r\n').join('\n');

const failures = [];

const seeds = [
  ['members', 'Member', 'MEMBERS'],
  ['trainers', 'Trainer', 'TRAINERS'],
  ['plans', 'Plan', 'PLANS'],
  ['transactions', 'Transaction', 'TRANSACTIONS'],
  ['sessions', 'Session', 'SESSIONS'],
  ['promotions', 'Promotion', 'PROMOTIONS'],
  ['staff', 'Staff', 'STAFF'],
];

for (const [field, type, constant] of seeds) {
  const pattern = new RegExp(`const \\[${field}, set\\w+\\]\\s*=\\s*useState<${type}\\[\\]>\\(\\(\\)\\s*=>\\s*\\[\\.\\.\\.${constant}\\]\\)`);
  const match = source.match(pattern);
  if (!match) {
    failures.push('seed:' + constant);
    continue;
  }
  source = source.replace(pattern, match[0].replace('[...' + constant + ']', '[]'));
}

const oldEffect = [
  '  useEffect(() => {',
  '    let active = true;',
  "    fetch('/api/gym-plans')",
  '      .then(async (response) => {',
  '        const result: unknown = await response.json();',
  '        if (!response.ok) {',
  "          const message = result && typeof result === 'object' && 'error' in result && typeof result.error === 'string'",
  '            ? result.error',
  "            : 'Membership plans could not be loaded.';",
  '          throw new Error(message);',
  '        }',
  "        if (!result || typeof result !== 'object' || !('plans' in result) || !Array.isArray(result.plans)) {",
  "          throw new Error('The membership plan service returned an invalid catalog.');",
  '        }',
  '        if (active) setPlans(result.plans as Plan[]);',
  '      })',
  '      .catch((error: unknown) => {',
  "        console.error('Could not load the database membership plan catalog.', error);",
  '      });',
  '    return () => { active = false; };',
  '  }, [setPlans]);',
].join('\n');

const newEffect = [
  '  // Live data source: every admin and member surface reads the same',
  '  // workspace snapshot instead of the bundled mock arrays.',
  '  useEffect(() => {',
  '    let active = true;',
  '',
  '    fetchWorkspace()',
  '      .then((snapshot) => {',
  '        if (!active) return;',
  '        if (snapshot.members) setMembers(snapshot.members);',
  '        if (snapshot.trainers) setTrainers(snapshot.trainers);',
  '        if (snapshot.plans) setPlans(snapshot.plans);',
  '        if (snapshot.transactions) setTransactions(snapshot.transactions);',
  '        if (snapshot.sessions) setSessions(snapshot.sessions);',
  '        if (snapshot.promotions) setPromotions(snapshot.promotions);',
  '        if (snapshot.staff) setStaff(snapshot.staff);',
  '      })',
  '      .catch((error: unknown) => {',
  "        console.error('Could not load the workspace from the database.', error);",
  '      });',
  '',
  '    return () => {',
  '      active = false;',
  '    };',
  '  }, []);',
].join('\n');

if (source.includes(oldEffect)) {
  source = source.replace(oldEffect, newEffect);
} else if (!source.includes('fetchWorkspace()')) {
  failures.push('effect-anchor');
}

if (!source.includes("from './lib/api-client.ts'")) {
  const anchor = "} from './data.ts';";
  if (!source.includes(anchor)) {
    failures.push('import-anchor');
  } else {
    source = source.replace(anchor, anchor + "\nimport { fetchWorkspace } from './lib/api-client.ts';");
  }
}

if (failures.length > 0) {
  process.stderr.write('FAILED: ' + failures.join(', ') + '\n');
  process.exit(1);
}

writeFileSync(target, source.split('\n').join(eol), 'utf8');

const written = readFileSync(target, 'utf8');
const checks = [
  ['import', /import \{ fetchWorkspace \} from '\.\/lib\/api-client\.ts';/.test(written)],
  ['load', /fetchWorkspace\(\)/.test(written)],
  ['members', /setMembers\(snapshot\.members\)/.test(written)],
  ['trainers', /setTrainers\(snapshot\.trainers\)/.test(written)],
  ['plans', /setPlans\(snapshot\.plans\)/.test(written)],
  ['transactions', /setTransactions\(snapshot\.transactions\)/.test(written)],
  ['sessions', /setSessions\(snapshot\.sessions\)/.test(written)],
  ['promotions', /setPromotions\(snapshot\.promotions\)/.test(written)],
  ['staff', /setStaff\(snapshot\.staff\)/.test(written)],
  ['old effect gone', !written.includes("fetch('/api/gym-plans')")],
  ['no member mocks', !/\[\.\.\.MEMBERS\]/.test(written)],
  ['no trainer mocks', !/\[\.\.\.TRAINERS\]/.test(written)],
  ['no plan mocks', !/\[\.\.\.PLANS\]/.test(written)],
  ['no transaction mocks', !/\[\.\.\.TRANSACTIONS\]/.test(written)],
  ['no session mocks', !/\[\.\.\.SESSIONS\]/.test(written)],
  ['no promotion mocks', !/\[\.\.\.PROMOTIONS\]/.test(written)],
  ['no staff mocks', !/\[\.\.\.STAFF\]/.test(written)],
];

const failed = checks.filter((pair) => !pair[1]).map((pair) => pair[0]);
if (failed.length > 0) {
  process.stderr.write('VERIFY FAILED: ' + failed.join(', ') + '\n');
  process.exit(2);
}

process.exit(0);
