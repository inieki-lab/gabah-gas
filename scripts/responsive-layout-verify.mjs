import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/responsive-overflow.css', import.meta.url), 'utf8');
const entry = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');
const design = readFileSync(new URL('../docs/design/DESIGN-SYSTEM.md', import.meta.url), 'utf8');

const requiredRules = [
  'overflow-x: clip',
  'overflow-x: auto',
  'overscroll-behavior-inline: contain',
  'min-width: 0',
  'max-width: calc(100vw - 2rem)',
  'max-height: calc(100dvh - 2rem)',
  'prefers-reduced-motion: reduce',
];

for (const rule of requiredRules) {
  assert.ok(css.includes(rule), `Missing responsive safeguard: ${rule}`);
}

assert.ok(entry.includes("import './responsive-overflow.css';"), 'Responsive stylesheet must be loaded by the application entry point.');
assert.ok(design.includes('Perlindungan Overflow dan Layar Kecil'), 'Responsive behavior must be documented in the design system.');
console.log(`Responsive layout verification passed (${requiredRules.length} safeguards).`);
