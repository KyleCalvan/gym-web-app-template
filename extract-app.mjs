import { readFileSync, writeFileSync } from 'node:fs';

const source = readFileSync('src/App.tsx', 'utf8');
const lines = source.split(/\r?\n/);
const slice = (from, to) => lines.slice(from - 1, to).map((l, i) => `${from + i}\t${l}`).join('\n');

writeFileSync('slice-state.txt', slice(80, 104), 'utf8');
writeFileSync('slice-effect.txt', slice(222, 258), 'utf8');
writeFileSync('slice-props.txt', slice(540, 600), 'utf8');
writeFileSync('slice-imports.txt', slice(1, 40), 'utf8');
process.exit(0);
