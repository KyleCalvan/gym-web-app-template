import { readFileSync, writeFileSync } from 'node:fs';

const target = 'app/api/members/route.ts';
const content = readFileSync(target, 'utf8');

// Show what we have
const lines = content.split('\n');
console.log('Line 95 before:', lines[94]);
console.log('Line 152 before:', lines[151]);

// Fix both issues
const fixed = content
  .replace(/\.Params;/g, '.Params;')
  .replace(/tx\.gymUser\.findUnique/g, 'tx.user.findUnique');

// Show what we'll have
const fixedLines = fixed.split('\n');
console.log('\nLine 95 after:', fixedLines[94]);
console.log('Line 152 after:', fixedLines[151]);

// Write
writeFileSync(target, fixed, 'utf8');

// Verify
const verify = readFileSync(target, 'utf8');
console.log('\nVerification:');
console.log('Contains .Params:', verify.includes('.Params;'));
console.log('Contains .Params:', verify.includes('.Params;'));
console.log('Contains tx.gymUser:', verify.includes('tx.gymUser'));
