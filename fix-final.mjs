import { readFileSync, writeFileSync } from 'node:fs';

const target = 'app/api/members/route.ts';
const original = readFileSync(target, 'utf8');
const eol = original.includes('\r\n') ? '\r\n' : '\n';
const lines = original.split('\r\n').join('\n').split('\n');

let urlFixes = 0;
let delegateFixes = 0;

const next = lines.map((line) => {
  let out = line;
  // Fix .Params -> .Params (any capitalization that isn't the correct one)
  if (out.includes('new URL(request.url)') && /\.Params/.test(out) && !out.includes('.Params')) {
    out = out.replace(/\.Params/g, '.Params');
    urlFixes += 1;
  }
  if (out.includes('tx.gymUser.findUnique')) {
    out = out.split('tx.gymUser.findUnique').join('tx.user.findUnique');
    delegateFixes += 1;
  }
  return out;
});

if (urlFixes === 0 || delegateFixes === 0) {
  process.stderr.write('urlFixes=' + urlFixes + ' delegateFixes=' + delegateFixes + '\n');
  process.exit(1);
}

const result = next.join('\n');
if (result.includes('.Params') || result.includes('tx.gymUser')) {
  process.stderr.write('residual bad references\n');
  process.exit(2);
}

writeFileSync(target, result.split('\n').join(eol), 'utf8');
process.stdout.write('urlFixes=' + urlFixes + ' delegateFixes=' + delegateFixes + '\n');
process.exit(0);
