import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/components/views/ContractsView.tsx', import.meta.url), 'utf8');

const checks = [
  [
    'Contract owner filter options come from persisted owner_division values',
    /const ownerDomains = useMemo\(\(\) => Array\.from\(new Set\([\s\S]*contract\.owner_division/.test(source)
      && /options: \['ALL', \.\.\.ownerDomains\], label: 'Owner'/.test(source),
  ],
  [
    'Legacy file-store create permission does not grant Supply Chain or PIBC by role label',
    /hasPermission\('contracts\.create', \['IT', 'GA'\]\)/.test(source)
      && !/hasPermission\('contracts\.create', \[[^\]]*(?:Supply Chain|PIBC)/.test(source),
  ],
  [
    'Legacy file-store document upload permission does not grant Supply Chain or PIBC by role label',
    /hasPermission\('contracts\.documents\.upload', \['IT', 'GA'\]\)/.test(source)
      && !/hasPermission\('contracts\.documents\.upload', \[[^\]]*(?:Supply Chain|PIBC)/.test(source),
  ],
  [
    'Legacy file-store renewal decision permission does not grant Supply Chain or PIBC by role label',
    /hasPermission\('contracts\.renewal\.decide', \['IT', 'GA'\]\)/.test(source)
      && !/hasPermission\('contracts\.renewal\.decide', \[[^\]]*(?:Supply Chain|PIBC)/.test(source),
  ],
];

let failed = 0;
for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} | ${name}`);
  if (!passed) failed += 1;
}
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed} | FAIL: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
